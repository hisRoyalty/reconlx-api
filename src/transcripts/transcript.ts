import { JSDOM } from "jsdom";
import fs from "fs";
import { TranscriptOptions } from "./transcript.interfaces";
import path from "path";
import { BufferResolvable } from "discord.js";

const dom = new JSDOM();
const document = dom.window.document;

const basePath = (file: string) => {
    return path.join(__dirname, "..", "..", "assets", file);
};

export const generateTranscript = (
    options: TranscriptOptions
): Promise<BufferResolvable> => {
    const { guild, channel, messages } = options;

    return new Promise(async (ful, rej) => {
        await fs.readFile(
            basePath("template.html"),
            "utf8",
            async function (err, data) {
                if (data) {
                    await fs.writeFile(
                        basePath("index.html"),
                        data,
                        async function (err) {
                            if (err) return console.log(err);
                            let info = document.createElement("div");
                            info.className = "info";
                            let iconClass = document.createElement("div");
                            iconClass.className = "info__guild-icon-container";
                            let guild__icon = document.createElement("img");
                            guild__icon.className = "info__guild-icon";
                            guild__icon.setAttribute("src", guild.iconURL());
                            iconClass.appendChild(guild__icon);
                            info.appendChild(iconClass);

                            let info__metadata = document.createElement("div");
                            info__metadata.className = "info__metadata";

                            let guildName = document.createElement("div");
                            guildName.className = "info__guild-name";
                            let gName = document.createTextNode(guild.name);
                            guildName.appendChild(gName);
                            info__metadata.appendChild(guildName);

                            let channelName = document.createElement("div");
                            channelName.className = "info__channel-name";
                            let cName = document.createTextNode(channel.name);
                            channelName.appendChild(cName);
                            info__metadata.appendChild(channelName);

                            let messagecount = document.createElement("div");
                            messagecount.className =
                                "info__channel-message-count";
                            messagecount.appendChild(
                                document.createTextNode(
                                    `Transcripted ${messages.length} messages.`
                                )
                            );
                            info__metadata.appendChild(messagecount);
                            info.appendChild(info__metadata);
                            await fs.appendFile(
                                basePath("index.html"),
                                info.outerHTML,
                                async function (err) {
                                    if (err) return console.log(err);
                                    messages.forEach(async (msg) => {
                                        let parentContainer =
                                            document.createElement("div");
                                        parentContainer.className =
                                            "parent-container";
                                        let avatarDiv =
                                            document.createElement("div");
                                        avatarDiv.className =
                                            "avatar-container";
                                        let img = document.createElement("img");
                                        img.setAttribute(
                                            "src",
                                            msg.author.avatar
                                        );
                                        img.className = "avatar";
                                        avatarDiv.appendChild(img);

                                        parentContainer.appendChild(avatarDiv);

                                        let messageContainer =
                                            document.createElement("div");
                                        messageContainer.className =
                                            "message-container";

                                        let nameElement =
                                            document.createElement("span");
                                        let name = document.createTextNode(
                                            msg.author.tag +
                                                " " +
                                                msg.createdAt.toDateString() +
                                                " " +
                                                msg.createdAt.toLocaleTimeString() +
                                                " EST"
                                        );
                                        nameElement.appendChild(name);
                                        messageContainer.append(nameElement);

                                        if (msg.content.startsWith("```")) {
                                            let m = msg.content.replace(
                                                /```/g,
                                                ""
                                            );
                                            let codeNode =
                                                document.createElement("code");
                                            let textNode =
                                                document.createTextNode(m);
                                            codeNode.appendChild(textNode);
                                            messageContainer.appendChild(
                                                codeNode
                                            );
                                        } else {
                                            let msgNode =
                                                document.createElement("span");
                                            let textNode =
                                                document.createTextNode(
                                                    msg.content
                                                );
                                            msgNode.append(textNode);
                                            messageContainer.appendChild(
                                                msgNode
                                            );
                                        }
                                        parentContainer.appendChild(
                                            messageContainer
                                        );
                                        await fs.appendFile(
                                            basePath("index.html"),
                                            parentContainer.outerHTML,
                                            function (err) {
                                                if (err)
                                                    return console.log(err);
                                            }
                                        );
                                    });
                                    fs.readFile(
                                        basePath("index.html"),
                                        (err, data) => {
                                            if (err) console.log(err);
                                            ful(data);
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            }
        );
    });
};
