import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import decompress from "decompress";
import path from 'path';

import { BinaryStatus, PROTOLS_CONFIG_PATH, ProtolsBinaryStatus } from './protols';

export async function installProtolsLanguageServer(destination: string): Promise<ProtolsBinaryStatus> {
    if (await getInstallConfirmationFromUser()) {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Downloading protols Language Server",
                cancellable: false
            }, async () => {
                await downloadProtolsFromGithub(destination);
            });
        }  catch(err) {
            if(err instanceof Error) {
                vscode.window.showErrorMessage(
                    `Failed to download protols Language Server; ".proto" file features will be unavailable.\r\n
                     ${err.message}`,
                );
                return {
                    status: BinaryStatus.Invalid
                };
            }
        }

        let protolsArgs: string[] = vscode.workspace.getConfiguration(PROTOLS_CONFIG_PATH).get("args") || [];

        return {
            status: BinaryStatus.Ok,
            command: {
                command: path.join(destination, getProtolsPlatformBinaryName()),
                args: protolsArgs,
            }
        };
    }
    return { status: BinaryStatus.NotInstalled };
}

var disableInstallDialogue = false;
async function getInstallConfirmationFromUser(): Promise<boolean> {
    if (disableInstallDialogue) {
        return false;
    }

    let installNowAction = "Install Now";
    let dontShowAgainAction = "Dont Show Again";

    let selectedAction = await vscode.window.showWarningMessage(
        `Protols language server is not installed, Download protols from Github?`,
        installNowAction,
        dontShowAgainAction);

    switch (selectedAction) {
        case installNowAction:
            return true;
        case dontShowAgainAction:
            disableInstallDialogue = true;
    }

    return false;
}

async function downloadProtolsFromGithub(destination: string): Promise<void> {
    const { Octokit } = await import("@octokit/rest");
    const octokit = new Octokit();

    const assetName = getProtolsGithubAssetName();

    const latestRelease = await octokit.repos.getLatestRelease({
        owner: "coder3101",
        repo: "protols"
    });

    let downloadURL: string = "";
    if (latestRelease.status >= 200 && latestRelease.status < 300) {
        for (const asset of latestRelease.data.assets) {
            if (asset.name === assetName) {
                downloadURL = asset.browser_download_url;
                break;
            }
        }
    } else {
        throw new Error(`Unable to get latest release info from Github: ${latestRelease.status} ${latestRelease.data}`);
    }

    const destinationCompressedFile = path.join(destination, assetName);

    await downloadFileFromURL(downloadURL, destinationCompressedFile);
    await decompress(destinationCompressedFile, destination);

    if (os.platform() === "linux") {
        let protolsExec = path.join(destination, getProtolsPlatformBinaryName());
        fs.chmodSync(protolsExec, "755");
    }
}

async function downloadFileFromURL(url: string, destination: string): Promise<void> {
    const res = await fetch(url);
    const responseData = res.body;
    if (!res.ok || responseData === null) {
        throw new Error(`Could not download file: ${res.url}, status: ${res.status}`);
    }

    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir);
    }

    const fileStream = fs.createWriteStream(destination);
    await finished(Readable.fromWeb(responseData).pipe(fileStream));
}

function getProtolsGithubAssetName(): string {
    const arch = os.arch();
    if (!["x64", "arm64"].includes(arch)) {
        throw new Error(`OS arch not supported: ${arch}`);
    }
    switch (os.platform()) {
        case "linux":
            return `protols-${arch === 'x64' ? "x86_64" : "aarch64"}-unknown-linux-gnu.tar.gz`;
        case "darwin":
            return `protols-${arch === 'x64' ? "x86_64" : "aarch64"}-apple-darwin.tar.gz`;
        case "win32":
            return "protols-x86_64-pc-windows-msvc.zip";
    }

    throw new Error(`Platform not supported: ${os.platform()}`);
}

export function getProtolsPlatformBinaryName(): string {
    if (os.platform() === "win32") {
        return "protols.exe";
    }
    return "protols";
}
