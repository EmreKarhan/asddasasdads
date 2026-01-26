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
            if (interaction.commandName === 'logchannel')
                return await handleLogSetup(interaction);
            if (interaction.commandName === 'resetlogs')
                return await handleLogReset(interaction);
            if (interaction.commandName === 'ticketstats')
                return await handleTicketStats(interaction);
            if (interaction.commandName === 'staffcheck')
                return await handleStaffCheck(interaction);
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category')
            return await handleCategorySelection(interaction);

        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_'))
            return await handleModalSubmit(interaction);

        if (interaction.isButton()) {
            if (interaction.customId === 'close_ticket') return await handleTicketClose(interaction);
            if (interaction.customId === 'confirm_close') return await handleTicketCloseConfirm(interaction);
            if (interaction.customId === 'cancel_close') return await handleTicketCloseCancel(interaction);
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
    
    const embed = new EmbedBuilder()
        .setTitle('👮 Staff Permission Check')
        .setColor(isStaff ? '#00ff00' : '#ff0000')
        .addFields(
            { name: 'User', value: `${interaction.user.tag}`, inline: true },
            { name: 'User ID', value: interaction.user.id, inline: true },
            { name: 'Server Owner', value: isOwner ? '✅ Yes' : '❌ No', inline: true },
            { name: 'Staff Permission', value: isStaff ? '✅ Yes' : '❌ No', inline: true },
            { 
                name: 'Required Roles', 
                value: config.ticketRoleId && config.ticketRoleId.length > 0 
                    ? config.ticketRoleId.map(r => `<@&${r}>`).join('\n') 
                    : 'Not set', 
                inline: false 
            }
        )
        .setFooter({ text: 'RuzySoft Ticket System' })
        .setTimestamp();
    
    await interaction.reply({ 
        embeds: [embed], 
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
    
    const embed = new EmbedBuilder()
        .setTitle('✅ Log Channel Set')
        .setDescription(`Log channel has been set to ${channel}.`)
        .setColor('#00ff00')
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
    
    const embed = new EmbedBuilder()
        .setTitle('✅ Log Channel Reset')
        .setDescription('Log channel has been reset. Ticket logs will no longer be sent.')
        .setColor('#ff9900')
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function handleTicketStats(interaction) {
    const openTickets = Object.values(ticketData).filter(t => t.status === 'open').length;
    const closedTickets = Object.values(ticketData).filter(t => t.status === 'closed').length;
    const totalTickets = Object.keys(ticketData).length;
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Ticket Statistics')
        .setColor('#5865F2')
        .addFields(
            { name: '📈 Open Tickets', value: `${openTickets}`, inline: true },
            { name: '📉 Closed Tickets', value: `${closedTickets}`, inline: true },
            { name: '📊 Total Tickets', value: `${totalTickets}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'RuzySoft Ticket System' });
    
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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

        const embed = new EmbedBuilder()
            .setTitle('<:greenplayer:1465424166303039711> RuzySoft | Tickets')
            .setDescription(
                `Your tickets will be automatically closed if they do not comply with the rules.\n\n` +
                `- Need assistance with our premium cheats? Create a ticket below!\n` +
                `- Your privacy and security are our top priority.\n` +
                `- Average response time: **5-15 minutes**\n\n` +
                `**⚠️ IMPORTANT:** Please provide accurate information. False or incomplete details will result in immediate ticket closure.`
            )
            .setColor('#5865F2')
            .setThumbnail('https://cdn.discordapp.com/attachments/1462207492275572883/1462402361761730602/391a9977-1ccc-4749-be4c-f8cdfd572f6e.png?ex=69794495&is=6977f315&hm=118716f91fb096884344f1cec26935b52e6907ee5aa4cb1effe6fb946260950b&')
            .setImage('https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png')
            .setFooter({ 
                text: 'RuzySoft - Ticket Bot',
                iconURL: 'https://cdn.discordapp.com/attachments/1462207492275572883/1462402361761730602/391a9977-1ccc-4749-be4c-f8cdfd572f6e.png?ex=69794495&is=6977f315&hm=118716f91fb096884344f1cec26935b52e6907ee5aa4cb1effe6fb946260950b&'
            })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('🎯 Select a category')
            .setMaxValues(1)
            .addOptions(
                Object.entries(config.categories).map(([key, c]) => ({
                    label: c.name,
                    description: c.description,
                    value: key,
                    emoji: c.emoji
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await targetChannel.send({
            embeds: [embed],
            components: [row]
        });

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

async function handleCategorySelection(interaction) {
    try {
        const selectedCategory = interaction.values[0];
        const category = config.categories[selectedCategory];

        const active = Object.values(ticketData)
            .find(t => t.userId === interaction.user.id && t.status === 'open');

        if (active) {
            return await interaction.reply({
                content: '❌ You already have an active ticket! Please close it before creating a new one.',
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

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error in handleCategorySelection:', error);
    }
}

async function handleModalSubmit(interaction) {
    try {
        const categoryKey = interaction.customId.split('_')[2];
        const category = config.categories[categoryKey];
        const guild = interaction.guild;
        const user = interaction.user;

        // Initial message
        await interaction.reply({
            content: '🔄 Creating your ticket...',
            flags: MessageFlags.Ephemeral
        });

        const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
        const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 20);
        const channelName = `${category.emoji}-${safeName}`;

        console.log(`Creating ticket for ${user.tag} with ID: ${ticketId}`);

        // 1. CREATE CHANNEL
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            topic: `Ticket ID: ${ticketId} | User: ${user.tag}`,
            reason: `Ticket created by ${user.tag}`
        });

        console.log(`Channel created: ${channel.id}`);

        // 2. SAVE DATA
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

        // 3. SET PERMISSIONS
        try {
            // Disable ViewChannel for @everyone
            await channel.permissionOverwrites.edit(guild.id, {
                ViewChannel: false
            });

            // Give permissions to bot
            await channel.permissionOverwrites.edit(client.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                ManageMessages: true,
                ManageChannels: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            // Give permissions to user
            await channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            });

            // Give permissions to staff roles
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

        // 4. TICKET EMBED
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${category.emoji} ${category.name} Ticket`)
            .setDescription(
                `**Ticket ID:** \`${ticketId}\`\n` +
                `**User:** ${user} (${user.tag})\n` +
                `**Category:** ${category.name}\n` +
                `**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                `**Status:** 🟢 **OPEN**\n\n` +
                `**📋 Ticket Information:**\n` +
                `• Our support team will assist you shortly\n` +
                `• Only staff members can close tickets\n` +
                `• Please be patient and provide necessary details`
            )
            .setColor('#5865F2')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: 'RuzySoft Premium Support • Staff only can close',
                iconURL: 'https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png'
            })
            .setTimestamp();

        // 5. QUESTIONS & ANSWERS
        let questions = [];
        switch (categoryKey) {
            case 'payment': questions = ['Username', 'Product', 'Payment Method']; break;
            case 'support': questions = ['Username', 'Related Product/Service', 'Issue Description']; break;
            case 'reseller': questions = ['Username', 'Business Name', 'Monthly Sales Estimate', 'Previous Experience']; break;
            case 'media': questions = ['Social Media Profile', 'Username', 'Video URL', 'Collaboration Proposal']; break;
            case 'hwid': questions = ['Username', 'Product Key', 'HWID Reset Reason']; break;
        }

        for (let i = 0; i < questions.length; i++) {
            const answer = interaction.fields.getTextInputValue(`question_${i}`);
            if (answer && answer.trim()) {
                ticketEmbed.addFields({
                    name: `📝 ${questions[i]}`,
                    value: `\`\`\`${answer.substring(0, 500)}\`\`\``,
                    inline: i < 2
                });
            }
        }

        // 6. CREATE BUTTON (Staff only close)
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Close (Staff Only)')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

        // 7. SEND MESSAGES
        try {
            // Welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setTitle('👋 Welcome to Your Support Ticket!')
                .setDescription(
                    `Hello ${user},\n\n` +
                    `Thank you for contacting **RuzySoft Premium Support**.\n` +
                    `Our team will assist you shortly.\n\n` +
                    `**Please provide:**\n` +
                    `• Detailed description\n` +
                    `• Screenshots if needed\n` +
                    `• Error messages\n\n` +
                    `⚠️ **Do not share your product key publicly!**`
                )
                .setColor('#00ff88')
                .setTimestamp();

            await channel.send({ embeds: [welcomeEmbed] });

            // Staff mention
            let mentionText = '';
            if (config.ticketRoleId && config.ticketRoleId.length > 0) {
                mentionText = config.ticketRoleId.map(r => `<@&${r}>`).join(' ');
            }

            // Main ticket message
            await channel.send({
                content: `${user} ${mentionText}`,
                embeds: [ticketEmbed],
                components: [buttonRow]
            });

            // 8. UPDATE USER
            await interaction.editReply({
                content: `✅ Ticket created: ${channel}`
            });

            // 9. SEND TO LOG CHANNEL (Optional)
            if (config.logChannelId && config.logChannelId !== "") {
                try {
                    const logChannel = guild.channels.cache.get(config.logChannelId);
                    if (logChannel) {
                        const permissions = logChannel.permissionsFor(client.user);
                        if (permissions.has(PermissionFlagsBits.SendMessages) && 
                            permissions.has(PermissionFlagsBits.EmbedLinks)) {
                            
                            const logEmbed = new EmbedBuilder()
                                .setTitle('🎫 New Ticket Created')
                                .setColor('#00ff88')
                                .addFields(
                                    { name: 'Ticket ID', value: ticketId, inline: true },
                                    { name: 'User', value: `${user.tag}`, inline: true },
                                    { name: 'Category', value: category.name, inline: true },
                                    { name: 'Channel', value: channel.toString(), inline: true }
                                )
                                .setTimestamp();
                            
                            await logChannel.send({ embeds: [logEmbed] });
                        }
                    }
                } catch (logError) {
                    console.log('Log optional error:', logError.message);
                }
            }

        } catch (sendError) {
            console.log('Send message error:', sendError.message);
            await interaction.editReply({
                content: `✅ Ticket created: ${channel} (Some messages may not have been sent)`
            });
        }

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
        
        // ONLY staff (ticketRole) and server owner can close tickets
        const isSupportStaff = hasSupportPermission(member);
        const isServerOwner = interaction.user.id === config.ownerId;
        
        // Ticket owner CANNOT close tickets
        const isTicketOwner = interaction.user.id === ticket.userId;
        
        if (!isSupportStaff && !isServerOwner) {
            // Special message for ticket owner
            if (isTicketOwner) {
                return await interaction.reply({
                    content: '❌ Ticket owners cannot close tickets. Please ask support staff for assistance.',
                    flags: MessageFlags.Ephemeral
                });
            }
            
            // Other users
            return await interaction.reply({
                content: '❌ Only support staff can close tickets!',
                flags: MessageFlags.Ephemeral
            });
        }

        const confirmEmbed = new EmbedBuilder()
            .setTitle('🔒 Confirm Ticket Closure')
            .setDescription(
                `**Staff Member:** ${interaction.user}\n` +
                `**Ticket ID:** ${ticket.id}\n` +
                `**Ticket Owner:** <@${ticket.userId}>\n` +
                `**Category:** ${config.categories[ticket.category].name}\n\n` +
                `⚠️ **This action cannot be undone!**\n` +
                `The channel will be permanently deleted.`
            )
            .setColor('#ff9900')
            .setFooter({ 
                text: 'RuzySoft Ticket System - Staff Action Required',
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

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
            embeds: [confirmEmbed],
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
        
        // Double permission check (for security)
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
            transcript += `║              RuzYSoft Ticket Transcript              ║\n`;
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
            
            const transcriptBuffer = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(transcriptBuffer, { 
                name: `ticket-${ticket.id}-transcript.txt` 
            });
            
            const duration = Math.floor((Date.now() - ticket.createdAt) / (1000 * 60));
            
            // Notification to ticket channel
            const closeEmbed = new EmbedBuilder()
                .setTitle('🔒 Ticket Closed by Staff')
                .setDescription(
                    `**Closed by:** ${interaction.user}\n` +
                    `**Ticket ID:** ${ticket.id}\n` +
                    `**Duration:** ${duration} minutes\n` +
                    `**Transcript:** Generated and saved\n\n` +
                    `*This channel will be deleted in 10 seconds...*`
                )
                .setColor('#ff0000')
                .setFooter({ 
                    text: 'RuzySoft Ticket System - Staff Action',
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTimestamp();
            
            await channel.send({ embeds: [closeEmbed] });
            
            // Send to log channel
            if (config.logChannelId) {
                try {
                    const logChannel = channel.guild.channels.cache.get(config.logChannelId);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📋 Ticket Closed by Staff')
                            .setColor('#ff0000')
                            .addFields(
                                { name: 'Ticket ID', value: ticket.id, inline: true },
                                { name: 'User', value: `<@${ticket.userId}>`, inline: true },
                                { name: 'Category', value: config.categories[ticket.category].name, inline: true },
                                { name: 'Opened', value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true },
                                { name: 'Duration', value: `${duration} minutes`, inline: true },
                                { name: 'Closed by', value: interaction.user.tag, inline: true }
                            )
                            .setFooter({ text: `Staff ID: ${interaction.user.id}` })
                            .setTimestamp();
                        
                        await logChannel.send({ 
                            embeds: [logEmbed],
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
