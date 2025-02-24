import {
    CloseMailSessionOptions,
    ModMailModelOptions,
    ModMailOptions,
} from "./modmail.interface";
import mongoose, { Schema } from "mongoose";
import {
    Client,
    Collection,
    Message,
    MessageActionRow,
    MessageButton,
    MessageEmbed,
    Snowflake,
    TextChannel,
    User,
} from "discord.js";
import { create } from "sourcebin";

export class ModMailClient {
    public options: ModMailOptions;
    public collection = new Collection<Snowflake, ModMailModelOptions>();
    public set = new Set<Snowflake>();
    public model = mongoose.model<ModMailModelOptions>(
        "reconlx-modmail",
        new Schema({
            User: String,
            Channel: String,
            Messages: Array,
        })
    );

    constructor(options: ModMailOptions) {
        if (mongoose.connection.readyState !== 1) {
            if (!options.mongooseConnectionString)
                throw new Error(
                    "There is no established  connection with mongoose and a mongoose connection is required!"
                );

            mongoose.connect(options.mongooseConnectionString, {
                useUnifiedTopology: true,
                useNewUrlParser: true,
            });

            this.options = options;
        }
    }

    public ready() {
        this.model.find({}).then((data) => {
            data.forEach((x) => {
                this.collection.set(x.User, x);
            });
        });
    }

    public async modmailListener(message: Message) {
        if (message.author.id === this.options.client.user.id) return;
        const sendMessage = async (
            channel: TextChannel | User,
            user: Snowflake
        ) => {
            const content = () => {
                const context = [];
                const attachment = message.attachments.first();
                if (message.content) context.push(message.content);
                if (attachment)
                    context.push(`[${attachment.url || attachment.proxyURL}]`);

                return context.join("  ");
            };

            // saving messages
            const data = await this.model.findOne({ User: user });
            if (data) {
                data.Messages = [
                    ...data.Messages,
                    `${message.author.tag} :: ${content()}`,
                ];

                data.save().catch((err) => {});
            }
            return channel.send(content()).catch(console.log);
        };
        if (message.channel.type === "DM") {
            const createMail = async () => {
                const user = message.author;
                if (this.set.has(user.id)) return;
                const guild = this.options.client.guilds.cache.get(
                    this.options.guildId
                );
                message.author.send(
                    this.options.custom?.user?.(user) ||
                        `Hi by dming me you are creating a modmail with **${guild.name}** staff team!`
                );
                this.set.add(user.id);

                const createdChannel = await guild.channels.create(
                    `${user.username}`,
                    {
                        type: "GUILD_TEXT",
                        parent: this.options.category,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: ["VIEW_CHANNEL"],
                            },
                            this.options.modmailRole
                                ? {
                                      id: this.options.modmailRole,
                                      allow: ["VIEW_CHANNEL", "SEND_MESSAGES"],
                                  }
                                : null,
                        ],
                    }
                );

                createdChannel
                    .send(
                        this.options.custom?.channel?.(user) || {
                            content: `<@&${this.options.modmailRole}>\n**${user.tag}** (${user.id}) has created a new ticket`,
                        }
                    )
                    .then((m) => m.pin());

                const props: ModMailModelOptions = {
                    User: user.id,
                    Channel: createdChannel.id,
                    Messages: [
                        this.options.custom?.saveMessageFormat?.(message) ||
                            `${message.author.tag} :: ${message.content}`,
                    ],
                };

                new this.model(props).save();

                this.collection.set(props.User, props);

                sendMessage(createdChannel, props.User);

                this.set.delete(props.User);
            };

            const data = this.collection.get(message.author.id);

            if (!data) return createMail();
            const channel = this.options.client.channels.cache.get(
                data.Channel
            ) as TextChannel;

            if (!channel)
                return this.model.deleteMany({ Channel: data.Channel });

            await sendMessage(channel, data.User);
        } else if (
            (message.channel as TextChannel).parentId === this.options.category
        ) {
            const data = this.collection.find(
                (x) => x.Channel === message.channelId
            );

            if (!data)
                return message.channel.send(
                    "an error occured, user is not found please delete this channel!"
                );

            const user = this.options.client.users.cache.get(data.User);
            await sendMessage(user, user.id);
        }
    }

    public async deleteMail({ channel, reason }: CloseMailSessionOptions) {
        const data = this.collection.find((x) => x.Channel === channel);
        const mailChannel = this.options.client.channels.cache.get(channel);

        if (data) {
            const modelData = await this.model.findOne({ User: data.User });

            const user = await this.options.client.users.fetch(data.User);

            if (this.options.transcriptChannel) {
                const transcriptChannel =
                    this.options.client.channels.cache.get(
                        this.options.transcriptChannel
                    ) as TextChannel;

                const url = (
                    await create([
                        {
                            content: modelData.Messages.join("\n"),
                            language:
                                this.options.custom?.language || "AsciiDoc",
                            name: `Transcript [${
                                user.tag
                            }] ${new Date().toLocaleString()}`,
                        },
                    ])
                ).url;

                const embed = new MessageEmbed()
                    .setAuthor(
                        user.tag,
                        user.displayAvatarURL({ dynamic: true })
                    )
                    .setColor(this.options.custom?.embedColor || "RANDOM")
                    .setTimestamp()
                    .setDescription(
                        [
                            `Message Count: ${modelData.Messages?.length || 0}`,
                            `Close Reason: ${reason || "No reason provided"}`,
                        ].join("\n")
                    );

                const components = [
                    new MessageActionRow().addComponents(
                        new MessageButton()
                            .setURL(url)
                            .setLabel("Transcript")
                            .setStyle("LINK")
                    ),
                ];

                mailChannel.delete();

                transcriptChannel.send({ embeds: [embed], components });
                this.collection.delete(data.User);
                await modelData.delete();
            }
        }
    }
}
