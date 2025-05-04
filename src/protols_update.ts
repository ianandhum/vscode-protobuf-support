import * as vscode from 'vscode';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { BinaryStatus, ProtolsBinaryStatus } from './protols';
import { installProtolsLanguageServer } from './protols_install';

const execFileAsync = promisify(execFile);

async function getCurrentVersion(command: string): Promise<string> {
    try {
        const { stdout } = await execFileAsync(command, ['--version']);
        const versionParts = stdout.split(' ');
        if (versionParts.length > 1) {
            return versionParts[1].trim();
        }
    } catch (error) {
        console.warn('Failed to get current version:', error);
    }
    return '0.0.0'; // Fallback if no version found
}

export async function checkForUpdates(protolsBinStatus: ProtolsBinaryStatus): Promise<void> {
    if (!protolsBinStatus.autoInstalled || protolsBinStatus.status !== BinaryStatus.Ok || !protolsBinStatus.command) {
        return;
    }

    const currentVersion = await getCurrentVersion(protolsBinStatus.command.command);
    const { Octokit } = await import("@octokit/rest");
    const octokit = new Octokit();
    
    try {
        const latestRelease = await octokit.repos.getLatestRelease({
            owner: "coder3101",
            repo: "protols"
        });

        if (latestRelease.status === 200) {
            const latestVersion = latestRelease.data.tag_name.replace('v', '');
            
            if (currentVersion !== latestVersion) {
                const updateAction = "Update Now";
                const skipAction = "Skip";
                
                const choice = await vscode.window.showInformationMessage(
                    `A new version of protols (${latestVersion}) is available. Current version: ${currentVersion}`,
                    updateAction,
                    skipAction
                );

                if (choice === updateAction) {
                    const storagePath = path.dirname(protolsBinStatus.command.command);
                    await installProtolsLanguageServer(storagePath, true);
                }
            }
        }
    } catch (error) {
        console.error('Failed to check for protols updates:', error);
    }
}
