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
        let downloaded = false;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Downloading protols Language Server",
            cancellable: false
        }, async () => {
            downloaded = await downloadProtolsFromGithub(destination);
        });

        if (!downloaded) {
            vscode.window.showErrorMessage(
                `Failed to download protols Language Server; ".proto" file features will be unavailable.`,
            );
            return {
                status: BinaryStatus.Invalid
            };
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

async function downloadProtolsFromGithub(destination: string): Promise<boolean> {
    const { Octokit } = await import("@octokit/rest");
    const octokit = new Octokit();

    const assetName = getProtolsGithubAssetName();

    if (!assetName) {
        console.log("protols: platform not supported");
        return false;
    }

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
        console.log("Github API returned an error: ", latestRelease.status, latestRelease.data);
    }

    if (downloadURL !== "") {
        const destinationCompressedFile = path.join(destination, assetName);
        if (!await downloadFileFromURL(downloadURL, destinationCompressedFile)) {
            return false;
        }
        await decompress(destinationCompressedFile, destination);
        if (os.platform() === "linux") {
            let protolsExec = path.join(destination, getProtolsPlatformBinaryName());
            fs.chmodSync(protolsExec, "755");
        }
        return true;
    }
    return false;
}

async function downloadFileFromURL(url: string, destination: string): Promise<boolean> {
    const res = await fetch(url);
    const responseData = res.body;
    if (!res.ok || responseData === null) {
        console.log("Could not download file: ", res.url, ", status: ", res.status);
        return false;
    }
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir);
    }
    const fileStream = fs.createWriteStream(destination);
    await finished(Readable.fromWeb(responseData).pipe(fileStream));

    return true;
}

function getProtolsGithubAssetName(): false | string {
    const arch = os.arch();
    switch (os.platform()) {
        case "linux":
            return `protols-${arch === 'x64' ? "x86_64" : "aarch64"}-unknown-linux-gnu.tar.gz`;
        case "darwin":
            return `protols-${arch === 'x64' ? "x86_64" : "aarch64"}-apple-darwin.tar.gz`;
        case "win32":
            return "protols-x86_64-pc-windows-msvc.zip";
    }
    return false;
}

export function getProtolsPlatformBinaryName(): string {
    if (os.platform() === "win32") {
        return "protols.exe";
    }
    return "protols";
}
