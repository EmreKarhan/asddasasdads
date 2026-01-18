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

function hasSupportPermission(member) {
    return config.ticketRoleId.some(roleId =>
        member.roles.cache.has(roleId)
    );
}

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} is online!`);
    
    client.user.setPresence({
        activities: [{
            name: 'RuzySoft Tickets',
            type: ActivityType.Watching
        }],
        status: 'online'
    });

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;

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
            name: 'forceclose',
            description: 'Force close a ticket',
            options: [{
                name: 'ticket_id',
                description: 'Ticket ID or mention channel',
                type: 3,
                required: true
            }]
        }
    ];

    for (const cmd of commands) {
        await guild.commands.create(cmd);
    }

    console.log('✨ Premium commands loaded!');
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ticketpanel')
            return handleTicketCommand(interaction);
        if (interaction.commandName === 'logchannel')
            return handleLogSetup(interaction);
        if (interaction.commandName === 'resetlogs')
            return handleLogReset(interaction);
        if (interaction.commandName === 'ticketstats')
            return handleTicketStats(interaction);
        if (interaction.commandName === 'forceclose')
            return handleForceClose(interaction);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category')
        return handleCategorySelection(interaction);

    if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_'))
        return handleModalSubmit(interaction);

    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') return handleTicketClose(interaction);
        if (interaction.customId === 'confirm_close') return handleTicketCloseConfirm(interaction);
        if (interaction.customId === 'cancel_close') return handleTicketCloseCancel(interaction);
        if (interaction.customId === 'transcript_ticket') return handleTranscript(interaction);
        if (interaction.customId === 'add_user') return handleAddUser(interaction);
        if (interaction.customId === 'lock_ticket') return handleLockTicket(interaction);
        if (interaction.customId === 'unlock_ticket') return handleUnlockTicket(interaction);
    }
});

async function handleLogSetup(interaction) {
    if (interaction.user.id !== config.ownerId) {
        return interaction.reply({
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
        return interaction.reply({
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
    if (interaction.user.id !== config.ownerId) {
        return interaction.reply({
            content: '❌ Only the server owner can use this command!',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetChannel = interaction.options.getChannel('channel');

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return interaction.editReply({
            content: '❌ Please select a valid text channel!'
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🎫 RuzySoft Premium Support')
        .setDescription(
            `**Welcome to RuzySoft Premium Support System!**\n\n` +
            `🚀 Need assistance with our premium cheats? Create a ticket below!\n` +
            `🔒 Your privacy and security are our top priority.\n` +
            `⚡ Average response time: **5-15 minutes**\n\n` +
            `**⚠️ IMPORTANT:** Please provide accurate information. False or incomplete details will result in immediate ticket closure.`
        )
        .setColor('#5865F2')
        .setThumbnail('https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png?ex=696d851c&is=696c339c&hm=6cf1cf227a013e3da5a8a89801d8886ea639e9d26ae1c8403cc10425d888d931&')
        .setImage('https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png?ex=696d851c&is=696c339c&hm=6cf1cf227a013e3da5a8a89801d8886ea639e9d26ae1c8403cc10425d888d931&')
        .setFooter({ 
            text: 'RuzySoft Revolution • Premium Cheat Solutions',
            iconURL: 'https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png?ex=696d851c&is=696c339c&hm=6cf1cf227a013e3da5a8a89801d8886ea639e9d26ae1c8403cc10425d888d931&'
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
}

async function handleCategorySelection(interaction) {
    const selectedCategory = interaction.values[0];
    const category = config.categories[selectedCategory];

    const active = Object.values(ticketData)
        .find(t => t.userId === interaction.user.id && t.status === 'open');

    if (active) {
        return interaction.reply({
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
                { label: 'Video URL', placeholder: 'Video URL (required for promotion)', required: true },
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
}

async function handleModalSubmit(interaction) {
    const categoryKey = interaction.customId.split('_')[2];
    const category = config.categories[categoryKey];
    const guild = interaction.guild;
    const user = interaction.user;

    const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
    const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '');
    const channelName = `${category.emoji}┋${safeName}-${ticketId.slice(-4)}`;

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.ticketCategoryId,
        topic: `Ticket: ${ticketId} | User: ${user.tag} | Category: ${category.name}`,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
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
            ...config.ticketRoleId.map(r => ({
                id: r,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks
                ]
            })),
            {
                id: config.botId || client.user.id,
                allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages]
            }
        ]
    });

    ticketData[channel.id] = {
        id: ticketId,
        userId: user.id,
        username: user.username,
        userTag: user.tag,
        category: categoryKey,
        createdAt: Date.now(),
        status: 'open',
        messages: []
    };

    const ticketEmbed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name} Ticket`)
        .setDescription(
            `**Ticket ID:** \`${ticketId}\`\n` +
            `**User:** ${user} (${user.tag})\n` +
            `**Category:** ${category.name}\n` +
            `**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
            `**Status:** 🟢 **OPEN**\n\n` +
            `**📋 Ticket Information:**\n` +
            `Our support team will assist you shortly. Please be patient.\n` +
            `Do not ping staff members unnecessarily.\n` +
            `Keep all discussions relevant to your issue.`
        )
        .setColor('#5865F2')
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: 'RuzySoft Premium Support • Use buttons below to manage ticket',
            iconURL: 'https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png?ex=696d851c&is=696c339c&hm=6cf1cf227a013e3da5a8a89801d8886ea639e9d26ae1c8403cc10425d888d931&'
        })
        .setTimestamp();

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
        if (!answer) continue;

        ticketEmbed.addFields({
            name: `📝 ${questions[i]}`,
            value: `\`\`\`${answer}\`\`\``,
            inline: i < 2
        });
    }

    const buttonRow1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket')
                .setLabel('🔒 Close')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('lock_ticket')
                .setLabel('🔐 Lock')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔐'),
            new ButtonBuilder()
                .setCustomId('add_user')
                .setLabel('➕ Add User')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('transcript_ticket')
                .setLabel('📄 Transcript')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📄')
        );

    const welcomeEmbed = new EmbedBuilder()
        .setTitle('👋 Welcome to Your Support Ticket!')
        .setDescription(
            `Hello ${user},\n\n` +
            `Thank you for contacting **RuzySoft Premium Support**.\n` +
            `Our team has been notified and will assist you shortly.\n\n` +
            `**Please provide:**\n` +
            `• Detailed description of your issue\n` +
            `• Relevant screenshots/videos\n` +
            `• Any error messages received\n\n` +
            `⚠️ **Do not share your product key or sensitive information publicly!**`
        )
        .setColor('#00ff88')
        .setTimestamp();

    await channel.send({ content: `${user}, welcome to your ticket!`, embeds: [welcomeEmbed] });
    await channel.send({ 
        content: `${user} ${config.ticketRoleId.map(r => `<@&${r}>`).join(' ')}`,
        embeds: [ticketEmbed],
        components: [buttonRow1]
    });

    await interaction.reply({
        content: `✅ Ticket created: ${channel}`,
        flags: MessageFlags.Ephemeral
    });

    if (config.logChannelId) {
        const logChannel = guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('🎫 New Ticket Created')
                .setColor('#00ff88')
                .addFields(
                    { name: 'Ticket ID', value: ticketId, inline: true },
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Category', value: category.name, inline: true },
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                )
                .setTimestamp();
            
            await logChannel.send({ embeds: [logEmbed] });
        }
    }
}

async function handleTicketClose(interaction) {
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];

    if (!ticket) {
        return interaction.reply({
            content: '❌ This is not a valid ticket channel!',
            flags: MessageFlags.Ephemeral
        });
    }

    const member = interaction.member;
    const isOwner = interaction.user.id === config.ownerId;
    const isStaff = hasSupportPermission(member);
    const isTicketOwner = interaction.user.id === ticket.userId;

    if (!isOwner && !isStaff && !isTicketOwner) {
        return interaction.reply({
            content: '❌ You do not have permission to close this ticket!',
            flags: MessageFlags.Ephemeral
        });
    }

    const confirmEmbed = new EmbedBuilder()
        .setTitle('🔒 Confirm Ticket Closure')
        .setDescription(
            `Are you sure you want to close this ticket?\n\n` +
            `**Ticket ID:** ${ticket.id}\n` +
            `**User:** <@${ticket.userId}>\n\n` +
            `⚠️ A transcript will be generated and sent to the logs.`
        )
        .setColor('#ff9900')
        .setTimestamp();

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_close')
                .setLabel('✅ Confirm Close')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_close')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmRow],
        flags: MessageFlags.Ephemeral
    });
}

async function handleTicketCloseConfirm(interaction) {
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];
    
    if (!ticket) return;

    await interaction.update({
        content: '🔄 Closing ticket and generating transcript...',
        embeds: [],
        components: []
    });

    try {
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
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(
                `This ticket has been closed by ${interaction.user}\n\n` +
                `**Duration:** ${duration} minutes\n` +
                `**Transcript:** Generated and sent to logs\n\n` +
                `*Channel will be deleted in 10 seconds...*`
            )
            .setColor('#ff0000')
            .setTimestamp();
        
        await channel.send({ embeds: [closeEmbed] });
        
        if (config.logChannelId) {
            const logChannel = channel.guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📋 Ticket Closed')
                    .setColor('#ff0000')
                    .addFields(
                        { name: 'Ticket ID', value: ticket.id, inline: true },
                        { name: 'User', value: `<@${ticket.userId}>`, inline: true },
                        { name: 'Category', value: config.categories[ticket.category].name, inline: true },
                        { name: 'Opened', value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true },
                        { name: 'Duration', value: `${duration} minutes`, inline: true },
                        { name: 'Closed by', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();
                
                await logChannel.send({ 
                    embeds: [logEmbed],
                    files: [attachment]
                });
            }
        }
        
        ticket.status = 'closed';
        ticket.closedAt = Date.now();
        ticket.closedBy = interaction.user.id;
        
        setTimeout(async () => {
            try {
                await channel.delete('Ticket closed');
            } catch (error) {
                console.error('Error deleting channel:', error);
            }
        }, 10000);
        
    } catch (error) {
        console.error('Error closing ticket:', error);
        await interaction.followUp({
            content: '❌ Error closing ticket!',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleTicketCloseCancel(interaction) {
    await interaction.update({
        content: '✅ Ticket closure cancelled.',
        embeds: [],
        components: []
    });
}

async function handleTranscript(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];
    
    if (!ticket) {
        return interaction.editReply('❌ This is not a ticket channel!');
    }
    
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        let transcript = `Transcript for ticket ${ticket.id}\n`;
        transcript += `User: ${ticket.userTag}\n`;
        transcript += `Generated: ${new Date().toLocaleString()}\n\n`;
        
        messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
            .forEach(msg => {
                transcript += `[${msg.createdAt.toLocaleTimeString()}] ${msg.author.username}: ${msg.content}\n`;
            });
        
        const buffer = Buffer.from(transcript, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { 
            name: `transcript-${ticket.id}.txt` 
        });
        
        await interaction.editReply({
            content: '📄 Here is your ticket transcript:',
            files: [attachment]
        });
    } catch (error) {
        await interaction.editReply('❌ Error generating transcript!');
    }
}

async function handleForceClose(interaction) {
    if (interaction.user.id !== config.ownerId && !hasSupportPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ Only staff can force close tickets!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    const identifier = interaction.options.getString('ticket_id');
    
    let targetChannel;
    if (identifier.startsWith('<#')) {
        const channelId = identifier.slice(2, -1);
        targetChannel = interaction.guild.channels.cache.get(channelId);
    } else {
        targetChannel = Object.keys(ticketData).find(chId => 
            ticketData[chId].id === identifier
        );
        if (targetChannel) {
            targetChannel = interaction.guild.channels.cache.get(targetChannel);
        }
    }
    
    if (!targetChannel || !ticketData[targetChannel.id]) {
        return interaction.reply({
            content: '❌ Ticket not found!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    const ticket = ticketData[targetChannel.id];
    const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Force Closed')
        .setDescription(`Ticket was force closed by ${interaction.user}`)
        .setColor('#ff0000')
        .setTimestamp();
    
    await targetChannel.send({ embeds: [closeEmbed] });
    
    setTimeout(async () => {
        try {
            await targetChannel.delete('Force closed by staff');
        } catch (error) {
            console.error('Error deleting channel:', error);
        }
    }, 5000);
    
    await interaction.reply({
        content: `✅ Ticket ${ticket.id} force closed!`,
        flags: MessageFlags.Ephemeral
    });
}

async function handleAddUser(interaction) {
    if (!hasSupportPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ Only staff can add users to tickets!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    // You can implement a modal or selection menu here for adding users
    await interaction.reply({
        content: '👤 Feature: Add user to ticket\n\nComing soon!',
        flags: MessageFlags.Ephemeral
    });
}

async function handleLockTicket(interaction) {
    if (!hasSupportPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ Only staff can lock tickets!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];
    
    if (!ticket) {
        return interaction.reply({
            content: '❌ This is not a ticket channel!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: false
    });
    
    const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Locked')
        .setDescription(`This ticket has been locked by ${interaction.user}`)
        .setColor('#ff9900')
        .setTimestamp();
    
    await channel.send({ embeds: [embed] });
    await interaction.reply({
        content: '✅ Ticket locked!',
        flags: MessageFlags.Ephemeral
    });
}

async function handleUnlockTicket(interaction) {
    if (!hasSupportPermission(interaction.member)) {
        return interaction.reply({
            content: '❌ Only staff can unlock tickets!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];
    
    if (!ticket) {
        return interaction.reply({
            content: '❌ This is not a ticket channel!',
            flags: MessageFlags.Ephemeral
        });
    }
    
    await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: true
    });
    
    const embed = new EmbedBuilder()
        .setTitle('🔓 Ticket Unlocked')
        .setDescription(`This ticket has been unlocked by ${interaction.user}`)
        .setColor('#00ff88')
        .setTimestamp();
    
    await channel.send({ embeds: [embed] });
    await interaction.reply({
        content: '✅ Ticket unlocked!',
        flags: MessageFlags.Ephemeral
    });
}

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    
    const channel = message.channel;
    const ticket = ticketData[channel.id];
    
    if (ticket && ticket.status === 'open') {
        ticket.messages.push({
            id: message.id,
            author: message.author.tag,
            content: message.content,
            timestamp: message.createdTimestamp,
            attachments: message.attachments.map(a => a.url)
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
