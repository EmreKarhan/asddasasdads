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
    
    client.user.setPresence({
        activities: [{
            name: 'RuzySoft Ticket System',
            type: ActivityType.Watching
        }],
        status: 'online'
    });

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
                description: 'Send premium ticket panel',
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

        console.log('✨ Premium commands loaded!');
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

        // ──────────────── BUTONLAR ────────────────
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
                content: '❌ Bir hata oluştu!',
                flags: MessageFlags.Ephemeral
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
                content: '❌ Geçersiz kategori!',
                flags: MessageFlags.Ephemeral
            });
        }

        // aynı kullanıcı aktif ticket kontrolü
        const active = Object.values(ticketData)
            .find(t => t.userId === interaction.user.id && t.status === 'open');

        if (active) {
            return await interaction.reply({
                content: '❌ Zaten açık bir ticketın var!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Modal oluştur
        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${categoryKey}`)
            .setTitle(`${category.emoji} ${category.name} Ticket`);

        // Questions ekle
        let questions = [];
        
        switch (categoryKey) {
            case 'payment':
                questions = [
                    { label: 'Username', placeholder: 'Your username on RuzySoft website', required: true },
                    { label: 'Product Name', placeholder: 'Enter the product you want to purchase', required: true },
                    { label: 'Payment Method', placeholder: 'Credit Card / Crypto / PayPal / etc.', required: true }
                ];
                break;

            case 'support':
                questions = [
                    { label: 'Username', placeholder: 'Your RuzySoft username', required: true },
                    { label: 'Product/Service', placeholder: 'Which product/service do you need help with?', required: true },
                    { label: 'Issue Description', placeholder: 'Describe your issue in detail...', required: true, style: TextInputStyle.Paragraph }
                ];
                break;

            case 'reseller':
                questions = [
                    { label: 'Username', placeholder: 'Your RuzySoft username', required: true },
                    { label: 'Business Name', placeholder: 'Your business/brand name', required: true },
                    { label: 'Monthly Sales Estimate', placeholder: 'Estimated monthly sales volume', required: true },
                    { label: 'Previous Experience', placeholder: 'Describe your previous reseller experience', required: true, style: TextInputStyle.Paragraph }
                ];
                break;

            case 'media':
                questions = [
                    { label: 'Social Media Profile', placeholder: 'TikTok/YouTube/Instagram link', required: true },
                    { label: 'Username', placeholder: 'Your RuzySoft username', required: true },
                    { label: 'Video URL', placeholder: 'Video URL (Required)', required: true },
                    { label: 'Collaboration Proposal', placeholder: 'What kind of collaboration are you looking for?', required: true, style: TextInputStyle.Paragraph }
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

        // Modal'ı göster
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
                content: '❌ Hata oluştu', 
                flags: MessageFlags.Ephemeral 
            }).catch(console.error);
        }
    }
}

async function handleTicketCommand(interaction) {
    try {
        if (interaction.user.id !== config.ownerId) {
            return await interaction.reply({
                content: '❌ Only the server owner can use this command!',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetChannel = interaction.options.getChannel('channel');

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return await interaction.editReply({
                content: '❌ Please select a valid text channel!'
            });
        }

        // Components-based message - NO EMBEDS
        const panelMessage = {
            flags: 32768,
            components: [
                {
                    type: 17, // Container component
                    components: [
                        {
                            type: 12, // Media component
                            items: [
                                {
                                    media: {
                                        url: 'https://cdn.discordapp.com/attachments/1462207492275572883/1465487422149103667/6b8b7fd9-735e-414b-ad83-a9ca8adeda40.png?ex=69794904&is=6977f784&hm=1c7c533a04b3a1c49ee89bab5f61fc80ec1a5dcc0dcfc25aaf91549a7d40c88f&'
                                    }
                                }
                            ]
                        },
                        {
                            type: 10, // Text component
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
            content: `✅ Premium ticket panel sent to ${targetChannel}`
        });

    } catch (error) {
        console.error('Error in handleTicketCommand:', error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: `❌ Error: ${error.message}`
            });
        } else {
            await interaction.reply({
                content: `❌ Error: ${error.message}`,
                flags: MessageFlags.Ephemeral
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
            flags: MessageFlags.Ephemeral
        });

        const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
        const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 20);
        const channelName = `${category.emoji}-${safeName}`;

        console.log(`Creating ticket for ${user.tag} with ID: ${ticketId}`);
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            topic: `Ticket ID: ${ticketId} | User: ${user.tag}`,
            reason: `Ticket created by ${user.tag}`
        });

        console.log(`Channel created: ${channel.id}`);

        // SAVE DATA
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

        // SET PERMISSIONS
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

        // First, send the user information with ticket details
        let questions = [];
        switch (categoryKey) {
            case 'payment': questions = ['Username', 'Product', 'Payment Method']; break;
            case 'support': questions = ['Username', 'Related Product/Service', 'Issue Description']; break;
            case 'reseller': questions = ['Username', 'Business Name', 'Monthly Sales Estimate', 'Previous Experience']; break;
            case 'media': questions = ['Social Media Profile', 'Username', 'Video URL', 'Collaboration Proposal']; break;
            case 'hwid': questions = ['Username', 'Product Key', 'HWID Reset Reason']; break;
        }

        // Create user info message
        let userInfoContent = `# ${category.emoji} ${category.name} Ticket\n`;
        userInfoContent += `**Ticket ID:** \`${ticketId}\`\n`;
        userInfoContent += `**User:** ${user} (${user.tag})\n`;
        userInfoContent += `**Category:** ${category.name}\n`;
        userInfoContent += `**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n`;
        userInfoContent += `**User Information:**\n`;

        for (let i = 0; i < questions.length; i++) {
            const answer = interaction.fields.getTextInputValue(`question_${i}`);
            if (answer && answer.trim()) {
                userInfoContent += `**${questions[i]}:** ${answer.substring(0, 500)}\n`;
            }
        }

        // Mention support roles
        let mentionText = '';
        if (config.ticketRoleId && config.ticketRoleId.length > 0) {
            mentionText = config.ticketRoleId.map(r => `<@&${r}>`).join(' ');
        }

        // Send user info first
        await channel.send({
            content: `${user} ${mentionText}\n${userInfoContent}`
        });

        // Now send the container component message
        const ticketMessage = {
            flags: 32768, // Ephemeral flag (for embed-like appearance)
            components: [
                {
                    type: 17, // Container Component
                    components: [
                        {
                            type: 12, // Media Component
                            items: [
                                {
                                    media: {
                                        url: 'https://cdn.discordapp.com/attachments/1462207492275572883/1465487422149103667/6b8b7fd9-735e-414b-ad83-a9ca8adeda40.png?ex=69794904&is=6977f784&hm=1c7c533a04b3a1c49ee89bab5f61fc80ec1a5dcc0dcfc25aaf91549a7d40c88f&'
                                    }
                                }
                            ]
                        },
                        {
                            type: 10, // Text Component
                            content: `${user} | ${category.emoji} ${category.name} Ticket\nMod: @staff`
                        },
                        {
                            type: 14, // Divider Component
                            divider: false
                        },
                        {
                            type: 14, // Divider Component
                            divider: false
                        },
                        {
                            type: 10, // Text Component
                            content: '# Welcome To Ruzy Support\nPlease describe your inquiry below. Our staff will be with you shortly.'
                        },
                        {
                            type: 1, // Action Row Component
                            components: [
                                {
                                    style: 2, // Secondary style
                                    type: 2, // Button
                                    label: 'Close Ticket',
                                    emoji: { name: '🔒' },
                                    custom_id: 'close_ticket'
                                },
                                {
                                    style: 4, // Danger style
                                    type: 2, // Button
                                    label: 'Delete',
                                    custom_id: 'delete_ticket'
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        // Send the container message
        await channel.send(ticketMessage);

        // Update interaction reply
        await interaction.editReply({
            content: `✅ Ticket created: ${channel}`
        });

    } catch (error) {
        console.error('Fatal error in handleModalSubmit:', error);
        
        let errorMsg = '❌ Error creating ticket! ';
        if (error.code === 50013) {
            errorMsg = '❌ Bot lacks permissions. Please give bot Manage Channels permission!';
        }
        
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ content: errorMsg });
        } else {
            await interaction.reply({ 
                content: errorMsg,
                flags: MessageFlags.Ephemeral 
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
                content: '❌ This is not a valid ticket channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        const member = interaction.member;
        
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        const isTicketOwner = interaction.user.id === ticket.userId;
        
        if (!isSupportStaff && !isServerOwner) {
            if (isTicketOwner) {
                return await interaction.reply({
                    content: '❌ Ticket owners cannot close tickets. Please ask support staff for assistance.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            return await interaction.reply({
                content: '❌ Only support staff can close tickets!',
                flags: MessageFlags.Ephemeral
            });
        }

        // CONFIRM MESSAGE - Components-based
        const confirmMessage = {
            flags: 64,
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 10,
                            content: `# Confirm Ticket Closure\n\n**Staff Member:** ${interaction.user}\n**Ticket ID:** ${ticket.id}\n**Ticket Owner:** <@${ticket.userId}>\n**Category:** ${config.categories[ticket.category].name}\n\n⚠️ **This action cannot be undone!**\nThe channel will be permanently deleted.`
                        },
                        {
                            type: 14,
                            divider: false
                        },
                        {
                            type: 1,
                            components: [
                                {
                                    style: 4,
                                    type: 2,
                                    label: '✅ Confirm Close',
                                    custom_id: 'confirm_close',
                                    emoji: '🔒'
                                },
                                {
                                    style: 2,
                                    type: 2,
                                    label: '❌ Cancel',
                                    custom_id: 'cancel_close',
                                    emoji: '❌'
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        await interaction.reply(confirmMessage);
        
    } catch (error) {
        console.error('Error in handleTicketClose:', error);
        await interaction.reply({
            content: '❌ An error occurred!',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleTicketCloseConfirm(interaction) {
    try {
        const channel = interaction.channel;
        const ticket = ticketData[channel.id];
        
        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a ticket channel!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        const member = interaction.member;
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        
        if (!isSupportStaff && !isServerOwner) {
            return await interaction.update({
                content: '❌ You are not authorized to close tickets!',
                components: []
            });
        }

        await interaction.update({
            content: '🔄 Closing ticket...',
            components: []
        });

        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            let transcript = `╔══════════════════════════════════════════════════╗\n`;
            transcript += `║               RuzySoft Ticket Log                ║\n`;
            transcript += `╠══════════════════════════════════════════════════╣\n`;
            transcript += `║ Ticket ID: ${ticket.id}\n`;
            transcript += `║ User: ${ticket.userTag} (${ticket.userId})\n`;
            transcript += `║ Category: ${config.categories[ticket.category].name}\n`;
            transcript += `║ Created: ${new Date(ticket.createdAt).toLocaleString()}\n`;
            transcript += `║ Closed: ${new Date().toLocaleString()}\n`;
            transcript += `║ Closed by: ${interaction.user.tag} (${interaction.user.id})\n`;
            transcript += `╚══════════════════════════════════════════════════╝\n\n`;
            
            sortedMessages.forEach(msg => {
                const timestamp = msg.createdAt.toLocaleString();
                const author = msg.author.tag;
                const content = msg.content || '[Attachment/Embed]';
                
                transcript += `[${timestamp}] ${author}: ${content}\n`;
                if (msg.attachments.size > 0) {
                    msg.attachments.forEach(att => {
                        transcript += `       📎 Attachment: ${att.url}\n`;
                    });
                }
            });
            
            const duration = Math.floor((Date.now() - ticket.createdAt) / (1000 * 60));
            
            // CLOSE NOTIFICATION - Components-based
            const closeMessage = {
                components: [
                    {
                        type: 17,
                        components: [
                            {
                                type: 10,
                                content: `# Ticket Closed\n\n**Closed by:** ${interaction.user}\n**Ticket ID:** ${ticket.id}\n**Duration:** ${duration} minutes\n\n*This channel will be deleted in 10 seconds...*`
                            }
                        ]
                    }
                ]
            };
            
            await channel.send(closeMessage);
            
            // Update ticket data
            ticket.status = 'closed';
            ticket.closedAt = Date.now();
            ticket.closedBy = interaction.user.id;
            
            // Wait 10 seconds and delete
            setTimeout(async () => {
                try {
                    await channel.delete(`Ticket closed by staff: ${interaction.user.tag}`);
                    delete ticketData[channel.id];
                } catch (deleteError) {
                    console.error('Error deleting channel:', deleteError);
                }
            }, 10000);
            
        } catch (error) {
            console.error('Error closing ticket:', error);
            await interaction.followUp({
                content: '❌ Error closing ticket!',
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Error in handleTicketCloseConfirm:', error);
    }
}

async function handleTicketCloseCancel(interaction) {
    await interaction.update({
        content: '✅ Ticket closure cancelled.',
        components: []
    });
}

async function handleTicketDelete(interaction) {
    try {
        const channel = interaction.channel;
        const ticket = ticketData[channel.id];

        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a valid ticket channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        const member = interaction.member;
        
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        
        if (!isSupportStaff && !isServerOwner) {
            return await interaction.reply({
                content: '❌ Only support staff can delete tickets!',
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.reply({
            content: '🗑️ Deleting ticket...',
            flags: MessageFlags.Ephemeral
        });

        // Delete ticket data
        delete ticketData[channel.id];
        
        // Delete channel
        await channel.delete('Ticket deleted by staff');

    } catch (error) {
        console.error('Error in handleTicketDelete:', error);
        await interaction.reply({
            content: '❌ Error deleting ticket!',
            flags: MessageFlags.Ephemeral
        });
    }
}

client.login(process.env.DISCORD_TOKEN);
