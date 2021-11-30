const core = require('@actions/core');
const fsPath = require('path');
const fs = require('fs');
const { create, globSource } = require('ipfs-http-client');
const { Keyring } = require('@polkadot/keyring');

async function main() {
    // 1. Get all inputs
    let path = core.getInput('path');
    const seeds = core.getInput('seeds');
    const ipfsGateway = core.getInput('gateway') || 'https://crustipfs.xyz';

    // 2. Check path and convert path
    const workspace = process.env.GITHUB_WORKSPACE.toString();
    if (!fsPath.isAbsolute(path)) {
        path = fsPath.join(workspace, path);
    }
    if (!fs.existsSync(path)) {
        throw new Error(`File/directory not exist: ${path}`);
    }

    // 3. Construct auth header
    const keyring = new Keyring();
    const pair = keyring.addFromUri(seeds);
    const sig = pair.sign(pair.address);
    const sigHex = '0x' + Buffer.from(sig).toString('hex');

    const authHeader = Buffer.from(`${pair.address}:${sigHex}`).toString('base64');

    // 4. Create ipfs http client
    const ipfs = create({
        url: ipfsGateway + '/api/v0',
        headers: {
            authorization: 'Basic ' + authHeader
        }
    });

    let file;
    for await (file of ipfs.addAll(globSource(path, '**/*', { hidden: true }), { chunker: 'size-1048576', wrapWithDirectory: true })) {
        core.info(`Added file. Path: ${file.path}, CID: ${file.cid.toV0().toString()}, Size: ${file.size}`);
    }

    if (file && file.cid) {
        core.setOutput('hash', file.cid.toV0().toString());
    } else {
        throw new Error('IPFS add failed, please try again.');
    }
}

main().catch(error => {
    core.setFailed(error.message);
});