import { Client, Collection, SlashCommandBuilder, type ClientOptions } from "discord.js";
interface Command {
    data: SlashCommandBuilder;
    execute: (...args: any[]) => Promise<void>;
}
export declare class ExtendedClient extends Client {
    commands: Collection<string, Command>;
    constructor(options: ClientOptions);
}
export {};
//# sourceMappingURL=index.d.ts.map