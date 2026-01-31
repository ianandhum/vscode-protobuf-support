import * as vscode from 'vscode';
import * as os from 'os';
import { ProtolsServer } from './server';
import { GithubAsset, GithubReleaseFetcher } from '../github/releases';


const GithubAssetInfo: GithubAsset = {
    owner: "coder3101",
    repo: "protols",
    assetName: getProtolsGithubAssetName(),
    fileName: `protols${os.platform() === "win32" ? ".exe" : ""}`
};

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

export class ProtolsInstaller {

    private protolsServer: ProtolsServer;
    private destination: string;
    private githubAssetFetcher: GithubReleaseFetcher;

    private updateCheckSkippedTill = Date.now();

    constructor(protolsServer: ProtolsServer) {
        this.protolsServer = protolsServer;
        this.destination = protolsServer.getConfig().storagePath;
        this.githubAssetFetcher = new GithubReleaseFetcher(GithubAssetInfo, this.destination);
    }

    public async install(force?: boolean): Promise<boolean> {
        if (force || await this.getInstallConfirmationFromUser()) {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Downloading protols Language Server",
                    cancellable: false
                }, async () => {
                    await this.githubAssetFetcher.fetchAndInstall();
                });
                return true;
            } catch (err) {
                console.error(`Error installing protols:`, err);
                if (err instanceof Error) {
                    vscode.window.showErrorMessage(
                        `Failed to download protols Language Server; ".proto" file features will be unavailable.\r\n
                     ${err.message}`,
                    );
                }
                return false;
            }
        }

        return false;
    }

    public async checkForUpdatesAndInstall(): Promise<boolean> {
        if (!this.protolsServer.isInstalled()) {
            return false;
        }

        // Avoid checking for updates too frequently
        if (Date.now() < this.updateCheckSkippedTill) {
            return false;
        }

        try {
            const { version } = await this.githubAssetFetcher.getLatestReleaseAsset() || {};
            if (!version) {
                return false;
            }

            if (version !== this.protolsServer.getVersion()) {
                const updateAction = "Update Now";
                const skipAction = "Skip";

                const choice = await vscode.window.showInformationMessage(
                    `A new version of protols (${version}) is available. Current version: ${this.protolsServer.getVersion()}`,
                    updateAction,
                    skipAction
                );

                if (choice === updateAction) {
                    const stopped = await this.protolsServer.stop(); // Stop the server before updating
                    if (!stopped) {
                        console.warn("Unable to stop protols server gracefully before update.");
                        return false;
                    }
                    return this.install(true);
                }

                if (choice === skipAction) {
                    // Skip checking for updates for the next 24 hours
                    this.updateCheckSkippedTill = Date.now() + 24 * 60 * 60 * 1000;
                }

                return false;
            }
        } catch (err: any) {
            console.error(`Error checking for protols updates:`, err);
            vscode.window.showErrorMessage(
                `Error checking for updates: \r\n 
                \n
                ${err.message}`,
            );

            // avoid updating for 1 hour
            this.updateCheckSkippedTill = Date.now() + 1 * 60 * 60 * 1000;

            // attempt to start the server again if it was stopped
            const started = await this.protolsServer.start();
            if (!started) {
                console.error("Unable to restart protols server after failed update check.");
            }
        }

        return false;
    }

    private disableInstallDialogue = false;

    private async getInstallConfirmationFromUser(): Promise<boolean> {
        if (this.disableInstallDialogue) {
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
                this.disableInstallDialogue = true;
        }

        return false;
    }
}
