import which from 'which';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import { promisify } from 'util';
import { execFile } from 'child_process';
import find from "find-process";


import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';


export const PROTOLS_EXEC = "protols";

export enum Status {
    UnInitialized,
    NotFound,
    Invalid,
    Ok,
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

    private autoInstalled: boolean = false;

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

    public async init(force: boolean = false): Promise<boolean> {
        if (!force && this.status === Status.Ok && this.command) {
            return true;
        }

        if (force && this.isRunning()) {
            await this.stop();
        }

        let resolvedProtolsPath: string = this.config.protolsPath || PROTOLS_EXEC;

        if (resolvedProtolsPath !== PROTOLS_EXEC) {
            this.status = this.getBinaryStatus(resolvedProtolsPath);
        } else {
            let binPath = await which(PROTOLS_EXEC, { nothrow: true });
            if (binPath === null) {
                resolvedProtolsPath = path.join(this.config.storagePath, this.getProtolsPlatformBinaryName());
                this.status = this.getBinaryStatus(resolvedProtolsPath);
                this.autoInstalled = true;

                if (this.status !== Status.Ok) {
                    console.log(`Protols binary not found in $PATH:`);
                    return false;
                }

            } else {
                // 'which()' already checks for executable permission
                resolvedProtolsPath = binPath;
                this.status = this.getBinaryStatus(binPath);
            }
        }

        if (this.status !== Status.Ok) {
            if (!this.isAutoInstalled()) {
                vscode.window.showErrorMessage(
                    `Protols server binary: '${resolvedProtolsPath}' is 
                        ${this.status === Status.NotFound ? "missing" :
                        "not executable"}, check protols configuration`,
                );
            }
            return false;
        }

        this.version = await this.getCurrentVersion(resolvedProtolsPath);
        this.command = {
            command: resolvedProtolsPath,
            args: this.config.protolsArgs || []
        };

        return true;
    }

    public async start(): Promise<boolean> {
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

    public async stop(): Promise<boolean> {
        if (this.status !== Status.Ok || !this.command) {
            return false;
        }

        if (this.client) {
            try {
                await this.client.stop();
            } catch (error) {
                console.error("Error stopping protols server:", error);

                // Attempt to kill any remaining protols processes
                // due a bug in protols versions prior to 0.13.2 because of improper shutdown handling

                let killed = false;
                await find("name", this.getProtolsPlatformBinaryName()).then((list) => {
                    list.forEach((proc) => {
                        try {
                            process.kill(proc.pid);
                            console.log(`Killed protols server process with PID: ${proc.pid}`);
                            killed = true;
                        } catch (err) {
                            console.error(`Failed to kill protols server process with PID: ${proc.pid}`, err);
                        }
                    });
                });

                this.client = undefined;
                return killed;
            }
        }
        
        return true;
    }

    public restart() {
        if (this.status !== Status.Ok || !this.command) {
            return;
        }

        if (!this.client) {
            console.log("Protols server is not running.");
            this.start();
            return;
        }


        this.stop().then(() => {
            this.start();
        });
    }

    public isRunning(): boolean {
        if (this.status !== Status.Ok) {
            return false;
        }

        return this.client !== undefined;
    }

    public isInstalled(): boolean {
        return this.status === Status.Ok;
    }

    public needsInstall(): boolean {
        return this.status === Status.NotFound && this.isAutoInstalled();
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
            const versionParts = stdout.split("\n", 1)[0].trim().split(' ');
            if (versionParts.length > 1) {
                return versionParts[1].trim();
            }
        } catch (error) {
            console.warn('Failed to get current version:', error);
        }
        return '0.0.0'; // Fallback if no version found
    }

}
