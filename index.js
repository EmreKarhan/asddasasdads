const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags,
    Events,
    ActivityType
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

let ticketData = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Error handling
client.on('error', (error) => {
    console.log('Bot error:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.log('Unhandled rejection:', error.message);
});

function hasSupportPermission(member) {
    if (!config.ticketRoleId || !Array.isArray(config.ticketRoleId)) {
        return false;
    }
    
    if (member.id === config.ownerId) {
        return true;
    }
    
    return config.ticketRoleId.some(roleId => {
        if (!roleId || typeof roleId !== 'string') return false;
        return member.roles.cache.has(roleId);
    });
}

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} is online!`);

    const activities = [
        {
            name: 'RUZYSOFT.NET',
            type: ActivityType.Watching
        },
        {
            name: 'discord.gg/pnTjcgSAMB',
            type: ActivityType.Watching
        }
    ];

    let index = 0;

    client.user.setPresence({
        activities: [activities[index]],
        status: 'dnd' // istersen online / idle yapabilirsin
    });

    setInterval(() => {
        index = (index + 1) % activities.length;

        client.user.setPresence({
            activities: [activities[index]],
            status: 'dnd'
        });
    }, 10000);

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
        console.log('Guild not found!');
        return;
    }

    try {
        await guild.commands.set([]);

        const commands = [
            {
                name: 'ticketpanel',
                description: 'Send ruzysoft ticket panel',
                options: [{
                    name: 'channel',
                    description: 'Channel to send panel to',
                    type: 7,
                    required: true
                }]
            }
        ];

        for (const cmd of commands) {
            await guild.commands.create(cmd);
        }

        console.log('Ruzysoft commands loaded!');
    } catch (error) {
        console.log('Command loading error:', error.message);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketpanel')
                return await handleTicketCommand(interaction);
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('ticket_')) {
                return await handleCategoryButton(interaction);
            }
            if (interaction.customId === 'close_ticket') return await handleTicketClose(interaction);
            if (interaction.customId === 'confirm_close') return await handleTicketCloseConfirm(interaction);
            if (interaction.customId === 'cancel_close') return await handleTicketCloseCancel(interaction);
        }

        if (interaction.customId === 'delete_ticket') return await handleTicketDelete(interaction);

        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
            return await handleModalSubmit(interaction);
        }

    } catch (error) {
        console.error('Interaction error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '<:GreenClose:1465658452729921589> An error has occurred!',
                ephemeral: true
            }).catch(() => {});
        }
    }
});

async function handleCategoryButton(interaction) {
    try {
        const categoryKey = interaction.customId.replace('ticket_', '');
        const category = config.categories[categoryKey];

        if (!category) {
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> Invalid category!',
                ephemeral: true
            });
        }

        const active = Object.values(ticketData)
            .find(t => t.userId === interaction.user.id && t.status === 'open');

        if (active) {
            return await interaction.reply({
                content: '🇹🇷 Zaten açık bir ticketın var.\n🇬🇧 You already have an open ticket.',
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${categoryKey}`)
            .setTitle(`${category.emoji} ${category.name} Ticket`);

        let questions = [];
        
        switch (categoryKey) {
            case 'payment':
                questions = [
                    { label: 'Username', placeholder: 'Your username on RuzySoft website', required: true },
                    { label: 'Product Name', placeholder: 'Enter the product you want to purchase', required: true },
                    { label: 'Payment Method', placeholder: 'Credit Card / Crypto / PayPal / etc.', required: true }
                ];
                break;

            case 'technical':
                questions = [
                    { label: 'Username', placeholder: 'Your RuzySoft username', required: true },
                    { label: 'Error Message or Code', placeholder: '(if any)', required: false },
                    { label: 'Issue Description', placeholder: 'Describe your issue in detail...', required: true, style: TextInputStyle.Paragraph }
                ];
                break;

            case 'other':
                questions = [
                    { label: 'Username', placeholder: 'Your RuzySoft username', required: true },
                    { label: 'Problem title', placeholder: 'Enter your problem title', required: true },
                    { label: 'Please describe your problem in detail.', placeholder: 'Estimated monthly sales volume', required: true },
                    { label: 'Reason', placeholder: 'What is the reason?', required: true, style: TextInputStyle.Paragraph }
                ];
                break;
                
            case 'hwid':
                questions = [
                    { label: 'Username', placeholder: 'Your RuzySoft username', required: true },
                    { label: 'Product Key', placeholder: 'Enter your valid product key', required: true },
                    { label: 'HWID Reset Reason', placeholder: 'Why do you need HWID reset?', required: true, style: TextInputStyle.Paragraph }
                ];
                break;
        }

        if (!questions || questions.length === 0) {
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> This category is temporarily unavailable.',
                ephemeral: true
            });
        }

        questions.forEach((q, index) => {
            const textInput = new TextInputBuilder()
                .setCustomId(`question_${index}`)
                .setLabel(q.label)
                .setPlaceholder(q.placeholder)
                .setRequired(q.required)
                .setStyle(q.style || TextInputStyle.Short)
                .setMaxLength(q.style === TextInputStyle.Paragraph ? 1000 : 100);
            
            const actionRow = new ActionRowBuilder().addComponents(textInput);
            modal.addComponents(actionRow);
        });
        
        await interaction.showModal(modal);

    } catch (err) {
        console.error('Error in handleCategoryButton:', err);
        
        // Eğer hata "InteractionAlreadyReplied" ise, sadece logla
        if (err.code === 'InteractionAlreadyReplied') {
            console.log('Interaction already handled, ignoring...');
            return;
        }
        
        // Diğer hatalar için
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: '<:GreenClose:1465658452729921589> Hata oluştu', 
                ephemeral: true 
            }).catch(console.error);
        }
    }
}

async function handleTicketCommand(interaction) {
    try {
        if (interaction.user.id !== config.ownerId) {
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> Only the server owner can use this command!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetChannel = interaction.options.getChannel('channel');

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return await interaction.editReply({
                content: '<:GreenClose:1465658452729921589> Please select a valid text channel!'
            });
        }

        // Components-based message - NO EMBEDS
        const panelMessage = {
            flags: 32768,
            components: [
                {
                    type: 17, 
                    components: [
                        {
                            type: 12,
                            items: [
                                {
                                    media: {
                                        url: 'https://cdn.discordapp.com/attachments/1462207492275572883/1465487422149103667/6b8b7fd9-735e-414b-ad83-a9ca8adeda40.png?ex=69794904&is=6977f784&hm=1c7c533a04b3a1c49ee89bab5f61fc80ec1a5dcc0dcfc25aaf91549a7d40c88f&'
                                    }
                                }
                            ]
                        },
                        {
                            type: 10, 
                            content: '# RUZYSOFT Support Center 🎫\nIf the required information is not provided, your ticket will be automatically closed!'
                        },
                        {
                            type: 14, // Divider component
                            divider: false
                        },
                        {
                            type: 10, // Text component
                            content: 'Select category:'
                        },
                        {
                            type: 1, // Action row
                            components: Object.entries(config.categories).map(([key, category]) => ({
                                style: category.style || 1,
                                type: 2,
                                label: category.name,
                                custom_id: `ticket_${key}`,
                                emoji: category.emoji
                            }))
                        }
                    ]
                }
            ]
        };

        await targetChannel.send(panelMessage);

        await interaction.editReply({
            content: `<:GreenConfirm:1465658485873180733> RuzySoft ticket panel sent to ${targetChannel}`
        });

    } catch (error) {
        console.error('Error in handleTicketCommand:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: `<:GreenClose:1465658452729921589> Error: ${error.message}`
            });
        } else {
            await interaction.reply({
                content: `<:GreenClose:1465658452729921589> Error: ${error.message}`,
                ephemeral: true
            });
        }
    }
}

async function handleModalSubmit(interaction) {
    try {
        const categoryKey = interaction.customId.split('_')[2];
        const category = config.categories[categoryKey];
        const guild = interaction.guild;
        const user = interaction.user;

        await interaction.reply({
            content: '🔄 Creating your ticket...',
            ephemeral: true
        });

        const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
        const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 20);
        const channelName = `ticket-${safeName}-${ticketId.slice(-6)}`;

        console.log(`Creating ticket for ${user.tag} with ID: ${ticketId}`);
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            topic: `Ticket ID: ${ticketId} | User: ${user.tag}`,
            reason: `Ticket created by ${user.tag}`
        });

        console.log(`Channel created: ${channel.id}`);

        ticketData[channel.id] = {
            id: ticketId,
            userId: user.id,
            username: user.username,
            userTag: user.tag,
            category: categoryKey,
            createdAt: Date.now(),
            status: 'open',
            channelId: channel.id
        };

        try {
            await channel.permissionOverwrites.edit(guild.id, {
                ViewChannel: false
            });

            await channel.permissionOverwrites.edit(client.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true,
                AttachFiles: true,
                EmbedLinks: true
            });
            await channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            if (config.ticketRoleId && Array.isArray(config.ticketRoleId)) {
                for (const roleId of config.ticketRoleId) {
                    try {
                        await channel.permissionOverwrites.edit(roleId, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            ManageMessages: true,
                            AttachFiles: true,
                            EmbedLinks: true
                        });
                    } catch (roleError) {
                        console.log(`Role ${roleId} error:`, roleError.message);
                    }
                }
            }

        } catch (permError) {
            console.log('Permission error (continuing):', permError.message);
        }

        let questions = [];
        switch (categoryKey) {
            case 'payment': questions = ['Username', 'Product', 'Payment Method']; break;
            case 'technical': questions = ['Username', 'Error Message or Code (if any)', 'Issue Description']; break;
            case 'other': questions = ['Username', 'Problem title', 'Detailed explanation', 'reason']; break;
            case 'hwid': questions = ['Username', 'Product Key', 'HWID Reset Reason']; break;
        }
        const staffMentions = Array.isArray(config.ticketRoleId)
            ? config.ticketRoleId.map(r => `<@&${r}>`).join(' ')
            : '@staff';
        
        const ticketMessage = {
            flags: 32768,
            components: [
                {
                    type: 17, 
                    components: [
                        {
                            type: 12, 
                            items: [
                                {
                                    media: {
                                        url: 'https://cdn.discordapp.com/attachments/1462207492275572883/1465487422149103667/6b8b7fd9-735e-414b-ad83-a9ca8adeda40.png?ex=69794904&is=6977f784&hm=1c7c533a04b3a1c49ee89bab5f61fc80ec1a5dcc0dcfc25aaf91549a7d40c88f&'
                                    }
                                }
                            ]
                        },
                        {
                            type: 10, 
                            content: `${user} | ${staffMentions}`
                        },
                        {
                            type: 14, 
                            divider: false
                        },
                        {
                            type: 14, 
                            divider: false
                        },
                        {
                            type: 10, 
                            content: '# Welcome To Ruzy Support\nPlease describe your inquiry below. Our staff will be with you shortly.'
                        },
                        {
                            type: 1, // Action Row Component
                            components: [
                                {
                                    style: 2, 
                                    type: 2, 
                                    label: 'Close Ticket',
                                    emoji: { id: '1465658485873180733' },
                                    custom_id: 'close_ticket'
                                },
                                {
                                    style: 4, 
                                    type: 2,
                                    label: 'Delete',
                                    custom_id: 'delete_ticket'
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        await channel.send(ticketMessage);
        await interaction.editReply({
            content: `<:GreenConfirm:1465658485873180733> Ticket created: ${channel}`
        });

    } catch (error) {
        console.error('Fatal error in handleModalSubmit:', error);
        
        let errorMsg = '<:GreenClose:1465658452729921589> Error creating ticket! ';
        if (error.code === 50013) {
            errorMsg = '<:GreenClose:1465658452729921589> Bot lacks permissions. Please give bot Manage Channels permission!';
        }
        
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: errorMsg });
        } else {
            await interaction.reply({ 
                content: errorMsg,
                ephemeral: true 
            });
        }
    }
}

async function handleTicketClose(interaction) {
    try {
        const channel = interaction.channel;
        const ticket = ticketData[channel.id];

        if (!ticket) {
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> This is not a valid ticket channel!',
                ephemeral: true
            });
        }

        const member = interaction.member;
        
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        const isTicketOwner = interaction.user.id === ticket.userId;
        
        if (!isSupportStaff && !isServerOwner) {
            if (isTicketOwner) {
                return await interaction.reply({
                    content: '<:GreenClose:1465658452729921589> Ticket owners cannot close tickets. Please ask support staff for assistance.',
                    ephemeral: true
                });
            }
            
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> Only support staff can close tickets!',
                ephemeral: true
            });
        }

        await interaction.reply({
            flags: 32768, 
            ephemeral: true,
            components: [
                {
                    type: 17, 
                    components: [
                        {
                            type: 10,
                            content:
                                '# <:GreenLock:1465656103801979124> Confirm Ticket Closure\n' +
                                `**Owner:** ${interaction.user}\n` +
                                `**Ticket ID:** ${ticket.id}\n` +
                                `**Category:** ${config.categories[ticket.category]?.name || 'Unknown'}`
                        },
                        {
                            type: 14,
                            divider: false
                        },
                        {
                            type: 10,
                            content:
                                '- This action is irreversible!\n' +
                                '- The channel will be permanently closed.'
                        },
                        {
                            type: 1, 
                            components: [
                                {
                                    type: 2,
                                    style: 4, // Danger
                                    label: 'Confirm Close',
                                    emoji: { id: '1465658485873180733' },
                                    custom_id: 'confirm_close'
                                },
                                {
                                    type: 2,
                                    style: 2, 
                                    label: 'Cancel',
                                    emoji: { id: '1465658452729921589' },
                                    custom_id: 'cancel_close'
                                }
                            ]
                        }
                    ]
                }
            ]
        });
        
    } catch (error) {
        console.error('Error in handleTicketClose:', error);
        await interaction.reply({
            content: '<:GreenClose:1465658452729921589> An error occurred!',
            ephemeral: true
        });
    }
}

async function handleTicketCloseConfirm(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.channel;
        const ticket = ticketData[channel.id];

        if (!ticket) {
            return await interaction.editReply({
                content: '<:GreenClose:1465658452729921589> This is not a valid ticket channel!',
                ephemeral: true
            });
        }

        const member = interaction.member;
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;

        if (!isSupportStaff && !isServerOwner) {
            return await interaction.editReply({
                content: '<:GreenClose:1465658452729921589> You are not authorized to close this ticket!',
                ephemeral: true
            });
        }

        await interaction.editReply({
            content: '<:GreenLock:1465656103801979124> Ticket is closing...',
            ephemeral: true
        });
        
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        const logLines = [];
        logLines.push('==============================');
        logLines.push('        RUZYSOFT TICKET LOG   ');
        logLines.push('==============================');
        logLines.push(`Ticket ID   : ${ticket.id}`);
        logLines.push(`Category    : ${config.categories[ticket.category]?.name}`);
        logLines.push(`Opened By   : ${ticket.userTag} (${ticket.userId})`);
        logLines.push(`Closed By   : ${interaction.user.tag} (${interaction.user.id})`);
        logLines.push(`Opened At   : ${new Date(ticket.createdAt).toLocaleString()}`);
        logLines.push(`Closed At   : ${new Date().toLocaleString()}`);
        logLines.push(`Channel     : ${channel.name}`);
        logLines.push('------------------------------');
        logLines.push('Messages:');
        logLines.push('------------------------------');

        sortedMessages.forEach(msg => {
            const time = msg.createdAt.toLocaleString();
            const author = msg.author.tag;
            const content = msg.content || '[Attachment/Embed]';
            logLines.push(`[${time}] ${author}: ${content}`);

            if (msg.attachments.size > 0) {
                msg.attachments.forEach(att => logLines.push(`   [Attachment] ${att.url}`));
            }
        });

        logLines.push('==============================');

        const logText = logLines.join('\n');
        const fileName = `ticket-${ticket.id}.txt`;
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, logText, 'utf8');

        // Log kanalına bildirim gönder
        if (config.logChannelId) {
            try {
                const logChannel = await interaction.guild.channels.fetch(config.logChannelId).catch(() => null);
                if (logChannel && logChannel.isTextBased()) {
                    // Önce dosyayı oluştur
                    const attachment = new AttachmentBuilder(fs.readFileSync(filePath))
                        .setName(fileName);
                    
                    // Önce dosyayı gönder
                    const fileMessage = await logChannel.send({
                        files: [attachment]
                    });
                    
                    // Sonra components mesajını gönder
                    const logMessage = {
                        flags: 32768,
                        components: [
                            {
                                type: 17,
                                components: [
                                    {
                                        type: 12,
                                        items: [
                                            {
                                                media: {
                                                    url: 'https://cdn.discordapp.com/attachments/1462207492275572883/1465487422149103667/6b8b7fd9-735e-414b-ad83-a9ca8adeda40.png'
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        type: 10,
                                        content: '# 🔒 Ticket Closed'
                                    },
                                    {
                                        type: 14,
                                        divider: false
                                    },
                                    {
                                        type: 10,
                                        content:
                                            `👤 **User:** <@${ticket.userId}>\n` +
                                            `🛠️ **Closed by:** <@${interaction.user.id}>\n` +
                                            `🎫 **Ticket ID:** ${ticket.id}\n` +
                                            `📁 **Category:** ${config.categories[ticket.category]?.name || 'Unknown'}\n` +
                                            `⏱️ **Duration:** ${Math.round((Date.now() - ticket.createdAt) / 60000)} minutes`
                                    },
                                    {
                                        type: 14,
                                        divider: false
                                    },
                                    {
                                        type: 10,
                                        content: `📎 **Log file:** [Download here](${fileMessage.attachments.first()?.url || '#'})`
                                    }
                                ]
                            }
                        ]
                    };
                    
                    await logChannel.send(logMessage);
                    console.log(`Ticket closure log sent to ${logChannel.name}`);
                }
            } catch (e) {
                console.log('Ticket close log error:', e.message);
                // Hata olursa sadece dosyayı gönder
                try {
                    const logChannel = await interaction.guild.channels.fetch(config.logChannelId);
                    const attachment = new AttachmentBuilder(fs.readFileSync(filePath))
                        .setName(fileName);
                    await logChannel.send({
                        content: `🔒 Ticket ${ticket.id} closed by <@${interaction.user.id}>`,
                        files: [attachment]
                    });
                } catch (err) {
                    console.log('Simple log send error:', err.message);
                }
            }
        }

        // Geçici log dosyasını sil
        setTimeout(() => fs.unlink(filePath, () => {}), 5000);

        ticket.status = 'closed';
        ticket.closedAt = Date.now();
        ticket.closedBy = interaction.user.id;

        setTimeout(async () => {
            try {
                await channel.delete(`Ticket closed by ${interaction.user.tag}`);
                delete ticketData[channel.id];
            } catch (err) {
                console.error('Channel delete error:', err);
            }
        }, 5000);

    } catch (error) {
        console.error('Error in handleTicketCloseConfirm:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Error', ephemeral: true }).catch(() => {});
        }
    }
}

async function handleTicketCloseCancel(interaction) {
  try {
    return await interaction.reply({
      content: '<:GreenConfirm:1465658485873180733> Ticket closure cancelled.',
      ephemeral: true
    });
  } catch (e) {
    // interaction daha önce yanıtlandıysa followUp
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp({
        content: '<:GreenConfirm:1465658485873180733> Ticket closure cancelled.',
        ephemeral: true
      }).catch(() => {});
    }
  }
}

async function handleTicketDelete(interaction) {
    try {
        const channel = interaction.channel;
        const ticket = ticketData[channel.id];

        if (!ticket) {
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> This is not a valid ticket channel!',
                ephemeral: true
            });
        }

        const member = interaction.member;
        
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        
        if (!isSupportStaff && !isServerOwner) {
            return await interaction.reply({
                content: '<:GreenClose:1465658452729921589> Only support staff can delete tickets!',
                ephemeral: true
            });
        }

        await interaction.reply({
            content: '🗑️ Deleting ticket...',
            ephemeral: true
        });

        // Delete ticket data
        delete ticketData[channel.id];
        
        // Delete channel
        await channel.delete('Ticket deleted by staff');

    } catch (error) {
        console.error('Error in handleTicketDelete:', error);
        await interaction.reply({
            content: '<:GreenClose:1465658452729921589> Error deleting ticket!',
            ephemeral: true
        });
    }
}

client.login(process.env.DISCORD_TOKEN);
