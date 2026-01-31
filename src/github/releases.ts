import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import decompress from "decompress";
import path from 'path';


export interface GithubAsset {
    owner: string;
    repo: string;
    assetName: string;

    fileName: string;
}

export class GithubReleaseFetcher {

    private asset: GithubAsset;
    private destination: string;

    public constructor(asset: GithubAsset, destination: string) {
        this.asset = asset;
        this.destination = destination;
    }

    public async getLatestReleaseAsset(): Promise<{url: string, version: string} | undefined> {
        const { Octokit } = await import("@octokit/rest");
        const octokit = new Octokit();

        const latestRelease = await octokit.repos.getLatestRelease({
            owner: this.asset.owner,
            repo: this.asset.repo,
        });

        if (latestRelease.status >= 200 && latestRelease.status < 300) {
            for (const asset of latestRelease.data.assets) {
                if (asset.name === this.asset.assetName) {
                    return {
                        url: asset.browser_download_url,
                        version: latestRelease.data.tag_name.replace('v', '')
                    };
                }
            }
        } else {
            throw new Error(`Unable to get latest release info from Github: ${latestRelease.status} ${latestRelease.data}`);
        }
    }

    public async fetchAndInstall(): Promise<void> {
        const {url} = await this.getLatestReleaseAsset() || {};
        if (!url) {
            throw new Error(`Asset: ${this.asset.assetName} not found in latest release of ${this.asset.owner}/${this.asset.repo}`);
        }

        const destinationCompressedFile = path.join(this.destination, this.asset.assetName);
      
        // Download the asset
        await GithubReleaseFetcher.downloadFileFromURL(url, destinationCompressedFile);
        
        // Extract the downloaded file
        await decompress(destinationCompressedFile, this.destination);

        // On Linux, we need to set executable permissions
        if (os.platform() === "linux") {
            let protolsExec = path.join(this.destination, this.asset.fileName);
            fs.chmodSync(protolsExec, "755");
        }
    }

    private static async downloadFileFromURL(url: string, destination: string): Promise<void> {
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
}