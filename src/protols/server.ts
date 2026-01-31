import which from 'which';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';


export const PROTOLS_EXEC = "protols";

export enum Status {
    UnInitialized,
    NotInstalled,
    Ok,
    Invalid,
    NotFound,
}

export interface Command {
    command: string
    args?: string[]
}

export interface Configuration {
    protolsPath: string;
    protolsArgs: string[];
    storagePath: string;
}

export class ProtolsServer {

    private status: Status;

    private autoInstalled?: boolean;

    private version?: string;

    private command?: Command;

    private config: Configuration;

    private client?: LanguageClient;

    constructor(config: Configuration) {
        this.status = Status.UnInitialized;
        this.config = config;
    }

    public getConfig(): Configuration {
        return this.config;
    }

    public async initServer(force?: boolean): Promise<boolean> {

        if (!force && this.status === Status.Ok && this.command) {
            return true;
        }

        if (force && this.isRunning()) {
            await this.stopServer();
        }

        let resolvedProtolsPath: string = this.config.protolsPath || PROTOLS_EXEC;
        let autoInstalled = false;

        if (resolvedProtolsPath !== PROTOLS_EXEC) {
            let status = this.getBinaryStatus(resolvedProtolsPath);
            this.status = status;
            if (status !== Status.Ok) {
                vscode.window.showErrorMessage(
                    `Protols server binary: '${resolvedProtolsPath}' is ${status === Status.NotFound ? "missing" : "not executable"}, check config.`,
                );
                return false;
            }
        } else {
            let binPath = await which(PROTOLS_EXEC, { nothrow: true });
            if (binPath === null) {
                resolvedProtolsPath = path.join(this.config.storagePath, this.getProtolsPlatformBinaryName());
                let status = this.getBinaryStatus(resolvedProtolsPath);
                if (status === Status.NotFound) {
                    this.status = Status.NotInstalled;
                    return false;
                }
                autoInstalled = true;
            }
        }

        let protolsArgs: string[] = this.config.protolsArgs || [];

        this.status = Status.Ok;
        this.autoInstalled = autoInstalled;
        this.version = await this.getCurrentVersion(resolvedProtolsPath);
        this.command = {
            command: resolvedProtolsPath,
            args: protolsArgs
        };

        return true;
    }

    public async startServer(): Promise<boolean> {
        if (this.status !== Status.Ok || !this.command) {
            console.log("Protols server is not installed or command is missing.");
            return false;
        }

        if (this.client) {
            console.log("Protols server is already running.");
            return true;
        }

        const serverOptions: ServerOptions = {
            run: {
                command: this.command.command,
                args: this.command.args,
                transport: TransportKind.stdio
            },
            debug: {
                command: this.command.command,
                args: this.command.args,
                transport: TransportKind.stdio
            }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'proto3' },
                { scheme: 'file', language: 'proto' }
            ],
        };

        this.client = new LanguageClient(
            'protols',
            'Protols Language Server',
            serverOptions,
            clientOptions
        );

        await this.client.start();

        return true;
    }

    public async stopServer() {
        if (this.status !== Status.Ok || !this.command) {
            return;
        }

        if (this.client) {
            try {
                await this.client.stop();
            } catch (error) {
                console.error("Error stopping protols server:", error);
                // FIXME: protols has not implemented shutdown correctly
                // See: https://github.com/coder3101/protols/issues/101
                // As a workaround, we ignore errors during shutdown
            }


            this.client = undefined;
        }
    }

    public restartServer() {
        if (this.status !== Status.Ok || !this.command) {
            return;
        }

        if (!this.client) {
            console.log("Protols server is not running.");
            this.startServer();
            return;
        }


        this.stopServer().then(() => {
            this.startServer();
        });
    }

    public isRunning(): boolean {
        if (this.status !== Status.Ok || !this.command) {
            return false;
        }

        return this.client !== undefined;
    }

    public isInstalled(): boolean {
        return this.status === Status.Ok;
    }

    public canAutoInstall(): boolean {
        return this.status === Status.NotInstalled;
    }

    public getVersion(): string {
        return this.version || 'unknown';
    }

    public isAutoInstalled(): boolean {
        return this.autoInstalled || false;
    }

    private getBinaryStatus(path: string): Status {
        let binExists = fs.existsSync(path);
        let isExecutable: boolean = false;

        if (binExists) {
            try {
                fs.accessSync(path, fs.constants.X_OK);
                isExecutable = true;
            } catch {
                isExecutable = false;
            }
        }

        if (!binExists) {
            return Status.NotFound;
        }

        if (!isExecutable) {
            return Status.Invalid;
        }

        return Status.Ok;
    }

    private getProtolsPlatformBinaryName(): string {
        if (os.platform() === "win32") {
            return "protols.exe";
        }
        return "protols";
    }

    private static execFileAsync = promisify(execFile);

    private async getCurrentVersion(command: string): Promise<string> {
        try {
            const { stdout } = await ProtolsServer.execFileAsync(command, ['--version']);
            const versionParts = stdout.split("\n")[0].trim().split(' ');
            if (versionParts.length > 1) {
                return versionParts[1].trim();
            }
        } catch (error) {
            console.warn('Failed to get current version:', error);
        }
        return '0.0.0'; // Fallback if no version found
    }

}
