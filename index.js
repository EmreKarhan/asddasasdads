const {
    Client,
    GatewayIntentBits,
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
    
    // Server owner check
    if (member.id === config.ownerId) {
        return true;
    }
    
    // Check if member has any support role
    return config.ticketRoleId.some(roleId => {
        if (!roleId || typeof roleId !== 'string') return false;
        return member.roles.cache.has(roleId);
    });
}

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} is online!`);
    
    client.user.setPresence({
        activities: [{
            name: 'RurySoft Ticket System',
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
                description: 'Send modern ticket panel',
                options: [{
                    name: 'channel',
                    description: 'Channel to send panel to',
                    type: 7,
                    required: true
                }]
            },
            {
                name: 'logchannel',
                description: 'Set log channel',
                options: [{
                    name: 'channel',
                    description: 'Log channel',
                    type: 7,
                    required: true
                }]
            },
            {
                name: 'resetlogs',
                description: 'Reset log channel'
            },
            {
                name: 'ticketstats',
                description: 'Show ticket statistics'
            },
            {
                name: 'staffcheck',
                description: 'Check staff permissions'
            },
            {
                name: 'closeticket',
                description: 'Close current ticket',
                options: [{
                    name: 'reason',
                    description: 'Reason for closing',
                    type: 3,
                    required: false
                }]
            }
        ];

        for (const cmd of commands) {
            await guild.commands.create(cmd);
        }

        console.log('✨ Modern ticket commands loaded!');
    } catch (error) {
        console.log('Command loading error:', error.message);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketpanel')
                return await handleTicketCommand(interaction);
            if (interaction.commandName === 'logchannel')
                return await handleLogSetup(interaction);
            if (interaction.commandName === 'resetlogs')
                return await handleLogReset(interaction);
            if (interaction.commandName === 'ticketstats')
                return await handleTicketStats(interaction);
            if (interaction.commandName === 'staffcheck')
                return await handleStaffCheck(interaction);
            if (interaction.commandName === 'closeticket')
                return await handleCloseCommand(interaction);
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category')
            return await handleCategorySelection(interaction);

        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_'))
            return await handleModalSubmit(interaction);

        if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket') return await handleCategorySelection(interaction);
            if (interaction.customId === 'close_ticket') return await handleTicketClose(interaction);
            if (interaction.customId === 'confirm_close') return await handleTicketCloseConfirm(interaction);
            if (interaction.customId === 'cancel_close') return await handleTicketCloseCancel(interaction);
            if (interaction.customId === 'ticket_help') return await handleTicketHelp(interaction);
            if (interaction.customId === 'refresh_ticket') return await handleRefreshTicket(interaction);
        }
    } catch (error) {
        console.error('Interaction error:', error);
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: '❌ An error occurred!',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
});

async function handleStaffCheck(interaction) {
    const isStaff = hasSupportPermission(interaction.member);
    const isOwner = interaction.user.id === config.ownerId;
    
    const content = `## 👮 Staff Permission Check\n` +
                   `**User:** ${interaction.user.tag}\n` +
                   `**User ID:** ${interaction.user.id}\n` +
                   `**Server Owner:** ${isOwner ? '✅ Yes' : '❌ No'}\n` +
                   `**Staff Permission:** ${isStaff ? '✅ Yes' : '❌ No'}\n` +
                   `**Required Roles:** ${config.ticketRoleId && config.ticketRoleId.length > 0 ? config.ticketRoleId.map(r => `<@&${r}>`).join(', ') : 'Not set'}`;
    
    await interaction.reply({ 
        content: content,
        flags: MessageFlags.Ephemeral 
    });
}

async function handleLogSetup(interaction) {
    if (interaction.user.id !== config.ownerId) {
        return await interaction.reply({
            content: '❌ Only the server owner can use this command!',
            flags: MessageFlags.Ephemeral
        });
    }

    const channel = interaction.options.getChannel('channel');
    
    config.logChannelId = channel.id;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    
    await interaction.reply({ 
        content: `✅ **Log Channel Set**\nLog channel has been set to ${channel}.`,
        flags: MessageFlags.Ephemeral 
    });
}

async function handleLogReset(interaction) {
    if (interaction.user.id !== config.ownerId) {
        return await interaction.reply({
            content: '❌ Only the server owner can use this command!',
            flags: MessageFlags.Ephemeral
        });
    }

    config.logChannelId = "";
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    
    await interaction.reply({ 
        content: '✅ **Log Channel Reset**\nLog channel has been reset. Ticket logs will no longer be sent.',
        flags: MessageFlags.Ephemeral 
    });
}

async function handleTicketStats(interaction) {
    const openTickets = Object.values(ticketData).filter(t => t.status === 'open').length;
    const closedTickets = Object.values(ticketData).filter(t => t.status === 'closed').length;
    const totalTickets = Object.keys(ticketData).length;
    
    const content = `## 📊 Ticket Statistics\n` +
                   `**📈 Open Tickets:** ${openTickets}\n` +
                   `**📉 Closed Tickets:** ${closedTickets}\n` +
                   `**📊 Total Tickets:** ${totalTickets}\n` +
                   `**Last Updated:** <t:${Math.floor(Date.now() / 1000)}:R>`;
    
    await interaction.reply({ 
        content: content,
        flags: MessageFlags.Ephemeral 
    });
}

async function handleCloseCommand(interaction) {
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
        return await interaction.reply({
            content: '❌ Only support staff can close tickets!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    await handleTicketCloseConfirm(interaction, reason);
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

        // Modern ticket panel without embeds
        const panelContent = `# 🎫 RurySoft | Ticket System\n` +
                           `### Need assistance? Create a ticket!\n\n` +
                           `▸ **Private & Secure Support**\n` +
                           `▸ **Authorized Staff Only**\n` +
                           `▸ **24/7 Response Time**\n` +
                           `▸ **Professional Service**\n\n` +
                           `⚠️ **Important:** Provide accurate information when creating tickets.\n` +
                           `📊 **Ticket Stats:** \`/ticketstats\`\n\n` +
                           `**Select a category below to get started:**`;

        // Create category buttons
        const categoryButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('🎫 Create Ticket')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('ticket_help')
                    .setLabel('❓ Help & Info')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Category selection menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('📂 Select Ticket Category')
            .setMaxValues(1)
            .addOptions(
                Object.entries(config.categories).map(([key, c]) => ({
                    label: c.name,
                    description: c.description,
                    value: key,
                    emoji: c.emoji
                }))
            );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        // Status row
        const statusRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('status')
                    .setLabel('🟢 System Online')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('refresh_ticket')
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Secondary)
            );

        await targetChannel.send({
            content: panelContent,
            components: [categoryButtons, selectRow, statusRow]
        });

        await interaction.editReply({
            content: `✅ Modern ticket panel sent to ${targetChannel}`
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

async function handleTicketHelp(interaction) {
    await interaction.reply({
        content: `## ❓ Ticket System Help\n\n` +
                `**How to create a ticket:**\n` +
                `1. Click "Create Ticket" button\n` +
                `2. Select a category from the dropdown\n` +
                `3. Fill out the form\n` +
                `4. Submit and wait for staff\n\n` +
                `**Ticket Rules:**\n` +
                `• Be respectful to staff\n` +
                `• Provide detailed information\n` +
                `• Don't create duplicate tickets\n` +
                `• Only ticket owner can view the channel\n\n` +
                `**Staff Commands:**\n` +
                `\`/closeticket [reason]\` - Close current ticket\n` +
                `\`/ticketstats\` - View ticket statistics\n` +
                `\`/staffcheck\` - Check your permissions`,
        flags: MessageFlags.Ephemeral
    });
}

async function handleRefreshTicket(interaction) {
    await interaction.reply({
        content: '🔄 Ticket system refreshed!',
        flags: MessageFlags.Ephemeral
    });
}

async function handleCategorySelection(interaction) {
    try {
        let selectedCategory;
        
        // Check if coming from button or select menu
        if (interaction.isButton()) {
            // Show category selection modal
            const modal = new ModalBuilder()
                .setCustomId('select_category_modal')
                .setTitle('🎟️ Select Ticket Category');
                
            const categoryInput = new TextInputBuilder()
                .setCustomId('category_select')
                .setLabel('Choose a category')
                .setPlaceholder('Type: support, payment, reseller, media, or hwid')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
                
            const actionRow = new ActionRowBuilder().addComponents(categoryInput);
            modal.addComponents(actionRow);
            
            return await interaction.showModal(modal);
        } else {
            selectedCategory = interaction.values[0];
        }

        const category = config.categories[selectedCategory];
        if (!category) {
            return await interaction.reply({
                content: '❌ Invalid category selected!',
                flags: MessageFlags.Ephemeral
            });
        }

        const active = Object.values(ticketData)
            .find(t => t.userId === interaction.user.id && t.status === 'open');

        if (active) {
            return await interaction.reply({
                content: `❌ You already have an active ticket!\nPlease close your existing ticket before creating a new one.\n**Ticket:** <#${active.channelId}>`,
                flags: MessageFlags.Ephemeral
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`ticket_modal_${selectedCategory}`)
            .setTitle(`${category.emoji} ${category.name} Ticket`);

        let questions = [];
        
        switch (selectedCategory) {
            case 'payment':
                questions = [
                    { label: 'Username', placeholder: 'Your RurySoft website username', required: true },
                    { label: 'Product Name', placeholder: 'Which product do you want to purchase?', required: true },
                    { label: 'Payment Method', placeholder: 'Credit Card / Crypto / PayPal etc.', required: true }
                ];
                break;

            case 'support':
                questions = [
                    { label: 'Username', placeholder: 'Your RurySoft username', required: true },
                    { label: 'Product/Service', placeholder: 'Product or service needing help', required: true },
                    { label: 'Issue Description', placeholder: 'Describe your issue in detail...', required: true, style: TextInputStyle.Paragraph }
                ];
                break;

            case 'reseller':
                questions = [
                    { label: 'Username', placeholder: 'Your RurySoft username', required: true },
                    { label: 'Business Name', placeholder: 'Your business/brand name', required: true },
                    { label: 'Monthly Sales Estimate', placeholder: 'Estimated sales volume', required: true },
                    { label: 'Previous Experience', placeholder: 'Your reseller experience...', required: true, style: TextInputStyle.Paragraph }
                ];
                break;

            case 'media':
                questions = [
                    { label: 'Social Media Profile', placeholder: 'TikTok/YouTube/Instagram link', required: true },
                    { label: 'Username', placeholder: 'Your RurySoft username', required: true },
                    { label: 'Video URL', placeholder: 'Video URL (Required)', required: true },
                    { label: 'Collaboration Proposal', placeholder: 'What kind of collaboration?', required: true, style: TextInputStyle.Paragraph }
                ];
                break;

            case 'hwid':
                questions = [
                    { label: 'Username', placeholder: 'Your RurySoft username', required: true },
                    { label: 'Product Key', placeholder: 'Enter your product key', required: true },
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

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error in handleCategorySelection:', error);
        await interaction.reply({
            content: '❌ Error opening ticket form!',
            flags: MessageFlags.Ephemeral
        });
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

        const ticketId = `TICKET-${Date.now().toString().slice(-8)}`;
        const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 15);
        const channelName = `🎫-${safeName}-${ticketId.slice(-4)}`;

        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            topic: `Ticket ID: ${ticketId} | User: ${user.tag} | Category: ${category.name}`,
            reason: `Ticket created by ${user.tag}`,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                },
                {
                    id: client.user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks
                    ]
                }
            ]
        });

        // Add staff permissions
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

        // Save ticket data
        ticketData[channel.id] = {
            id: ticketId,
            userId: user.id,
            username: user.username,
            userTag: user.tag,
            category: categoryKey,
            createdAt: Date.now(),
            status: 'open',
            channelId: channel.id,
            answers: []
        };

        // Collect answers
        let questions = [];
        switch (categoryKey) {
            case 'payment': questions = ['Username', 'Product', 'Payment Method']; break;
            case 'support': questions = ['Username', 'Related Product/Service', 'Issue Description']; break;
            case 'reseller': questions = ['Username', 'Business Name', 'Monthly Sales Estimate', 'Previous Experience']; break;
            case 'media': questions = ['Social Media Profile', 'Username', 'Video URL', 'Collaboration Proposal']; break;
            case 'hwid': questions = ['Username', 'Product Key', 'HWID Reset Reason']; break;
        }

        let answerText = '';
        for (let i = 0; i < questions.length; i++) {
            const answer = interaction.fields.getTextInputValue(`question_${i}`);
            if (answer && answer.trim()) {
                answerText += `**${questions[i]}:**\n\`\`\`${answer.substring(0, 300)}\`\`\`\n`;
                ticketData[channel.id].answers.push({ question: questions[i], answer: answer });
            }
        }

        // Create ticket content
        const ticketContent = `# 🎫 ${category.emoji} ${category.name} Ticket\n` +
                            `**Ticket ID:** \`${ticketId}\`\n` +
                            `**User:** ${user} (\`${user.tag}\`)\n` +
                            `**Category:** ${category.name}\n` +
                            `**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
                            `## 📋 Ticket Information\n` +
                            `${answerText}\n` +
                            `## 👥 Assigned Staff\n` +
                            `${config.ticketRoleId && config.ticketRoleId.length > 0 ? config.ticketRoleId.map(r => `<@&${r}>`).join(' ') : 'Awaiting staff assignment...'}\n\n` +
                            `📌 **Please provide additional details if needed.**`;

        // Welcome message
        const welcomeContent = `# 👋 Welcome to Your Ticket!\n` +
                              `Hello ${user},\n\n` +
                              `Thank you for contacting **RurySoft Support**.\n` +
                              `Our team will assist you shortly.\n\n` +
                              `**📝 Please provide:**\n` +
                              `▸ Detailed description of your issue\n` +
                              `▸ Screenshots if applicable\n` +
                              `▸ Error messages\n` +
                              `▸ Steps to reproduce\n\n` +
                              `⚠️ **Do not share sensitive information publicly!**\n` +
                              `✅ **Keep all communication in this channel**`;

        // Control buttons
        const controlButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Close Ticket')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('refresh_ticket')
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Send messages
        await channel.send({ content: welcomeContent });
        await channel.send({ 
            content: ticketContent,
            components: [controlButtons]
        });

        await interaction.editReply({
            content: `✅ Ticket created successfully!\n**Channel:** ${channel}\n**ID:** \`${ticketId}\``
        });

        // Send to log channel
        if (config.logChannelId && config.logChannelId !== "") {
            try {
                const logChannel = guild.channels.cache.get(config.logChannelId);
                if (logChannel) {
                    const logContent = `## 🎫 New Ticket Created\n` +
                                     `**Ticket ID:** \`${ticketId}\`\n` +
                                     `**User:** ${user.tag} (${user.id})\n` +
                                     `**Category:** ${category.name}\n` +
                                     `**Channel:** ${channel}\n` +
                                     `**Time:** <t:${Math.floor(Date.now() / 1000)}:T>`;
                    
                    await logChannel.send({ content: logContent });
                }
            } catch (logError) {
                console.log('Log error:', logError.message);
            }
        }

    } catch (error) {
        console.error('Fatal error in handleModalSubmit:', error);
        
        let errorMsg = '❌ Error creating ticket! ';
        if (error.code === 50013) {
            errorMsg = '❌ Bot lacks permissions. Please give bot "Manage Channels" permission!';
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

        const confirmContent = `## 🔒 Confirm Ticket Closure\n` +
                              `**Staff Member:** ${interaction.user}\n` +
                              `**Ticket ID:** \`${ticket.id}\`\n` +
                              `**Ticket Owner:** <@${ticket.userId}>\n` +
                              `**Category:** ${config.categories[ticket.category].name}\n\n` +
                              `⚠️ **This action cannot be undone!**\n` +
                              `The channel will be permanently deleted.\n\n` +
                              `*Please confirm your action:*`;

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_close')
                    .setLabel('✅ Confirm Close')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('❌ Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        await interaction.reply({
            content: confirmContent,
            components: [confirmRow],
            flags: MessageFlags.Ephemeral
        });
        
    } catch (error) {
        console.error('Error in handleTicketClose:', error);
        await interaction.reply({
            content: '❌ An error occurred!',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleTicketCloseConfirm(interaction, reason = 'No reason provided') {
    try {
        const channel = interaction.channel;
        const ticket = ticketData[channel.id];
        
        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a ticket channel!',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Double permission check
        const member = interaction.member;
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        
        if (!isSupportStaff && !isServerOwner) {
            return await interaction.update({
                content: '❌ You are not authorized to close tickets!',
                embeds: [],
                components: []
            });
        }

        await interaction.update({
            content: '🔄 Closing ticket and generating transcript...',
            embeds: [],
            components: []
        });

        try {
            // Create transcript
            const messages = await channel.messages.fetch({ limit: 100 });
            const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            
            let transcript = `╔══════════════════════════════════════════════════╗\n`;
            transcript += `║               RurySoft Ticket Log                ║\n`;
            transcript += `╠══════════════════════════════════════════════════╣\n`;
            transcript += `║ Ticket ID: ${ticket.id}\n`;
            transcript += `║ User: ${ticket.userTag} (${ticket.userId})\n`;
            transcript += `║ Category: ${config.categories[ticket.category].name}\n`;
            transcript += `║ Created: ${new Date(ticket.createdAt).toLocaleString()}\n`;
            transcript += `║ Closed: ${new Date().toLocaleString()}\n`;
            transcript += `║ Closed by: ${interaction.user.tag} (${interaction.user.id})\n`;
            transcript += `║ Reason: ${reason}\n`;
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
            
            const transcriptBuffer = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(transcriptBuffer, { 
                name: `ticket-${ticket.id}-transcript.txt` 
            });
            
            const duration = Math.floor((Date.now() - ticket.createdAt) / (1000 * 60));
            
            // Notification to ticket channel
            const closeContent = `## 🔒 Ticket Closed\n` +
                               `**Closed by:** ${interaction.user}\n` +
                               `**Ticket ID:** \`${ticket.id}\`\n` +
                               `**Duration:** ${duration} minutes\n` +
                               `**Reason:** ${reason}\n` +
                               `**Transcript:** Generated and saved\n\n` +
                               `*This channel will be deleted in 10 seconds...*`;
            
            await channel.send({ content: closeContent });
            
            // Send to log channel
            if (config.logChannelId) {
                try {
                    const logChannel = channel.guild.channels.cache.get(config.logChannelId);
                    if (logChannel) {
                        const logContent = `## 📋 Ticket Closed\n` +
                                         `**Ticket ID:** \`${ticket.id}\`\n` +
                                         `**User:** <@${ticket.userId}>\n` +
                                         `**Category:** ${config.categories[ticket.category].name}\n` +
                                         `**Opened:** <t:${Math.floor(ticket.createdAt / 1000)}:R>\n` +
                                         `**Duration:** ${duration} minutes\n` +
                                         `**Closed by:** ${interaction.user.tag}\n` +
                                         `**Reason:** ${reason}`;
                        
                        await logChannel.send({ 
                            content: logContent,
                            files: [attachment]
                        });
                    }
                } catch (logError) {
                    console.log('Log error:', logError);
                }
            }
            
            // Update ticket data
            ticket.status = 'closed';
            ticket.closedAt = Date.now();
            ticket.closedBy = interaction.user.id;
            ticket.closeReason = reason;
            
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
        embeds: [],
        components: []
    });
}

client.login(process.env.DISCORD_TOKEN);
