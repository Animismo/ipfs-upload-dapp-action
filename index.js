const core = require('@actions/core');
const fsPath = require('path');
const fs = require('fs');
const IpfsHttpClient = require('ipfs-http-client');
const { globSource } = IpfsHttpClient;
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
    const ipfs = IpfsHttpClient({
        url: ipfsGateway + '/api/v0',
        headers: {
            authorization: 'Basic ' + authHeader
        }
    });

    // const { cid } = await ipfs.addAll(globSource(path, "**/*", { recursive: true, hidden: true }), {
    //     pin: true,
    //     wrapWithDirectory: true,
    //     timeout: 600000
    // });
    for await (let result of ipfs.addAll(globSource(path, "**/*", { recursive: true, hidden: true, followSymlinks: true }), {
        pin: true,
        wrapWithDirectory: true,
        timeout: 600000
    })) {
        core.info(result);
    }
    const { cid } = result;

    if (cid) {
        core.info(`hash: ${cid.toV0().toString()}`);
        core.setOutput('hash', cid.toV0().toString());
    } else {
        throw new Error('IPFS add failed, please try again.');
    }
}

main().catch(error => {
    core.setFailed(error.message);
});