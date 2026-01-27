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
        GatewayIntentBits.GuildMembers
    ]
});

// CONTAINER STYLES - Discohook'taki gibi
const containerStyles = {
    header: (text) => `# ${text}\n`,
    subheader: (text) => `## ${text}\n`,
    section: (text) => `### ${text}\n`,
    bold: (text) => `**${text}**`,
    italic: (text) => `*${text}*`,
    code: (text) => `\`${text}\``,
    codeBlock: (text, lang = '') => `\`\`\`${lang}\n${text}\n\`\`\``,
    listItem: (text) => `• ${text}\n`,
    checkbox: (checked, text) => `- [${checked ? 'x' : ' '}] ${text}\n`,
    divider: () => `---\n`,
    quote: (text) => `> ${text}\n`,
    spoiler: (text) => `||${text}||`,
    link: (text, url) => `[${text}](${url})`,
    timestamp: (time) => `<t:${Math.floor(time / 1000)}:R>`
};

// CONTAINER BUILDER - Discohook benzeri sistem
function createContainer(content, components = []) {
    return {
        content: content,
        components: components
    };
}

// PANEL CONTAINER
function createPanelContainer() {
    const content = containerStyles.header('🎫 RurySoft Ticket System') +
                   containerStyles.divider() +
                   containerStyles.subheader('Get Professional Support') +
                   'Need assistance? Create a ticket for fast, secure help.\n\n' +
                   containerStyles.section('Key Features') +
                   containerStyles.listItem('Private 1-on-1 support') +
                   containerStyles.listItem('24/7 staff availability') +
                   containerStyles.listItem('Secure communication') +
                   containerStyles.listItem('Fast response times') +
                   '\n' +
                   containerStyles.section('Important') +
                   containerStyles.checkbox(true, 'Provide accurate information') +
                   containerStyles.checkbox(true, 'Be respectful to staff') +
                   containerStyles.checkbox(false, 'Share sensitive data') +
                   containerStyles.checkbox(false, 'Create duplicate tickets') +
                   '\n' +
                   containerStyles.divider() +
                   containerStyles.bold('Status:') + ' 🟢 Online | ' +
                   containerStyles.bold('Avg. Wait:') + ' < 15min\n' +
                   containerStyles.code('Last updated: ' + new Date().toLocaleTimeString());

    const buttonRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket_btn')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫'),
            new ButtonBuilder()
                .setCustomId('ticket_info_btn')
                .setLabel('Info')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('ℹ️')
        );

    const selectRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ticket_category_select')
                .setPlaceholder('📁 Select category...')
                .addOptions([
                    { label: 'Technical Support', value: 'support', emoji: '🔧', description: 'Get help with products' },
                    { label: 'Payment & Billing', value: 'payment', emoji: '💳', description: 'Payment issues & purchases' },
                    { label: 'Reseller Program', value: 'reseller', emoji: '🤝', description: 'Partnership inquiries' },
                    { label: 'Media & Collab', value: 'media', emoji: '🎬', description: 'Collaboration requests' },
                    { label: 'HWID Reset', value: 'hwid', emoji: '🔄', description: 'Hardware ID reset' }
                ])
        );

    return createContainer(content, [buttonRow, selectRow]);
}

// TICKET CONTAINER
function createTicketContainer(ticketId, user, category, answers = []) {
    const content = containerStyles.header(`🎫 ${category.name} Ticket`) +
                   containerStyles.divider() +
                   containerStyles.subheader('Ticket Information') +
                   containerStyles.bold('Ticket ID:') + ' ' + containerStyles.code(ticketId) + '\n' +
                   containerStyles.bold('User:') + ` ${user} (${user.tag})\n` +
                   containerStyles.bold('Category:') + ` ${category.name}\n` +
                   containerStyles.bold('Created:') + ` ${containerStyles.timestamp(Date.now())}\n` +
                   containerStyles.bold('Status:') + ' 🟢 Open\n\n' +
                   containerStyles.subheader('Provided Details');
    
    let detailsContent = content;
    answers.forEach((answer, index) => {
        detailsContent += containerStyles.bold(`${answer.question}:`) + '\n' +
                         containerStyles.codeBlock(answer.answer.substring(0, 200)) + '\n';
    });

    detailsContent += '\n' +
                     containerStyles.divider() +
                     containerStyles.subheader('Assigned Staff') +
                     (config.ticketRoleId && config.ticketRoleId.length > 0 ? 
                      config.ticketRoleId.map(r => `<@&${r}>`).join(' ') : 
                      'Awaiting assignment...') +
                     '\n\n' +
                     containerStyles.section('Instructions') +
                     containerStyles.listItem('Wait for staff response') +
                     containerStyles.listItem('Provide additional details if needed') +
                     containerStyles.listItem('Do not share sensitive information') +
                     containerStyles.listItem('Only staff can close this ticket');

    const controlRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('close_ticket_btn')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒'),
            new ButtonBuilder()
                .setCustomId('add_user_btn')
                .setLabel('Add User')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥'),
            new ButtonBuilder()
                .setCustomId('transcript_btn')
                .setLabel('Transcript')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
        );

    return createContainer(detailsContent, [controlRow]);
}

// WELCOME CONTAINER
function createWelcomeContainer(user) {
    const content = containerStyles.header('👋 Welcome to Your Ticket!') +
                   '\n' +
                   `Hello ${user},\n\n` +
                   'Thank you for contacting **RurySoft Support**.\n' +
                   'Our team has been notified and will assist you shortly.\n\n' +
                   containerStyles.section('What to Expect') +
                   containerStyles.listItem('Response within 15-30 minutes') +
                   containerStyles.listItem('24/7 support availability') +
                   containerStyles.listItem('Private communication only') +
                   '\n' +
                   containerStyles.section('How to Help Us') +
                   containerStyles.listItem('Describe your issue in detail') +
                   containerStyles.listItem('Include screenshots if possible') +
                   containerStyles.listItem('Share error messages') +
                   containerStyles.listItem('List steps to reproduce') +
                   '\n' +
                   containerStyles.section('Security Notice') +
                   containerStyles.bold('NEVER') + ' share passwords or 2FA codes\n' +
                   containerStyles.bold('NEVER') + ' share product keys publicly\n' +
                   containerStyles.bold('ALWAYS') + ' verify staff identity\n' +
                   containerStyles.bold('REPORT') + ' suspicious behavior\n\n' +
                   containerStyles.italic('We\'re here to help! Please wait patiently.');

    return createContainer(content, []);
}

// LOG CONTAINER
function createLogContainer(type, data) {
    let content = '';
    
    switch(type) {
        case 'created':
            content = containerStyles.header('📝 Ticket Created') +
                     containerStyles.divider() +
                     containerStyles.bold('Ticket ID:') + ` \`${data.ticketId}\`\n` +
                     containerStyles.bold('User:') + ` ${data.userTag} (\`${data.userId}\`)\n` +
                     containerStyles.bold('Category:') + ` ${data.category}\n` +
                     containerStyles.bold('Channel:') + ` ${data.channel}\n` +
                     containerStyles.bold('Time:') + ` ${containerStyles.timestamp(Date.now())}`;
            break;
            
        case 'closed':
            content = containerStyles.header('🔒 Ticket Closed') +
                     containerStyles.divider() +
                     containerStyles.bold('Ticket ID:') + ` \`${data.ticketId}\`\n` +
                     containerStyles.bold('User:') + ` <@${data.userId}> (${data.userTag})\n` +
                     containerStyles.bold('Category:') + ` ${data.category}\n` +
                     containerStyles.bold('Opened:') + ` ${containerStyles.timestamp(data.createdAt)}\n` +
                     containerStyles.bold('Duration:') + ` ${data.duration} minutes\n` +
                     containerStyles.bold('Closed by:') + ` ${data.closedBy}\n` +
                     containerStyles.bold('Reason:') + ` ${data.reason}\n` +
                     containerStyles.bold('Messages:') + ` ${data.messageCount}`;
            break;
    }
    
    return createContainer(content, []);
}

client.once('ready', async () => {
    console.log(`🔥 ${client.user.tag} is online!`);
    
    client.user.setPresence({
        activities: [{
            name: 'RurySoft Container System',
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
                description: 'Send ticket panel (container system)',
                options: [{
                    name: 'channel',
                    description: 'Channel to send panel to',
                    type: 7,
                    required: true
                }]
            },
            {
                name: 'containerstats',
                description: 'Show ticket container statistics'
            },
            {
                name: 'staffcheck',
                description: 'Check staff container permissions'
            }
        ];

        for (const cmd of commands) {
            await guild.commands.create(cmd);
        }

        console.log('✨ Container-based commands loaded!');
    } catch (error) {
        console.log('Command loading error:', error.message);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketpanel')
                return await handleContainerPanel(interaction);
            if (interaction.commandName === 'containerstats')
                return await handleContainerStats(interaction);
            if (interaction.commandName === 'staffcheck')
                return await handleContainerStaffCheck(interaction);
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_category_select')
                return await handleContainerCategorySelect(interaction);
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('ticket_form_'))
                return await handleContainerFormSubmit(interaction);
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'create_ticket_btn')
                return await handleContainerCreateButton(interaction);
            if (interaction.customId === 'ticket_info_btn')
                return await handleContainerInfoButton(interaction);
            if (interaction.customId === 'close_ticket_btn')
                return await handleContainerCloseButton(interaction);
            if (interaction.customId === 'confirm_close_btn')
                return await handleContainerCloseConfirm(interaction);
            if (interaction.customId === 'cancel_close_btn')
                return await handleContainerCloseCancel(interaction);
            if (interaction.customId === 'add_user_btn')
                return await handleContainerAddUser(interaction);
            if (interaction.customId === 'transcript_btn')
                return await handleContainerTranscript(interaction);
        }
    } catch (error) {
        console.error('Container interaction error:', error);
        if (interaction.isRepliable()) {
            await interaction.reply({
                content: '❌ Container error occurred!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
});

async function handleContainerPanel(interaction) {
    if (interaction.user.id !== config.ownerId) {
        return await interaction.reply({
            content: '❌ Only owner can send container panel!',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetChannel = interaction.options.getChannel('channel');
    
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return await interaction.editReply({
            content: '❌ Select a valid text channel!'
        });
    }

    const panelContainer = createPanelContainer();
    
    await targetChannel.send(panelContainer);

    await interaction.editReply({
        content: `✅ Container panel sent to ${targetChannel}`
    });
}

async function handleContainerStats(interaction) {
    const openTickets = Object.values(ticketData).filter(t => t.status === 'open').length;
    const closedTickets = Object.values(ticketData).filter(t => t.status === 'closed').length;
    
    const content = containerStyles.header('📊 Container Statistics') +
                   containerStyles.divider() +
                   containerStyles.bold('Open Tickets:') + ` \`${openTickets}\`\n` +
                   containerStyles.bold('Closed Tickets:') + ` \`${closedTickets}\`\n` +
                   containerStyles.bold('Total Tickets:') + ` \`${Object.keys(ticketData).length}\`\n` +
                   containerStyles.bold('Active Sessions:') + ` \`${openTickets}\`\n\n` +
                   containerStyles.bold('System Status:') + ' 🟢 Operational\n' +
                   containerStyles.bold('Last Updated:') + ` ${containerStyles.timestamp(Date.now())}`;

    await interaction.reply({
        content: content,
        flags: MessageFlags.Ephemeral
    });
}

async function handleContainerStaffCheck(interaction) {
    const isStaff = config.ticketRoleId && config.ticketRoleId.some(roleId => 
        interaction.member.roles.cache.has(roleId)
    );
    
    const content = containerStyles.header('🔧 Staff Container Check') +
                   containerStyles.divider() +
                   containerStyles.bold('User:') + ` ${interaction.user.tag}\n` +
                   containerStyles.bold('User ID:') + ` \`${interaction.user.id}\`\n` +
                   containerStyles.bold('Staff Permission:') + ` ${isStaff ? '✅ Yes' : '❌ No'}\n` +
                   containerStyles.bold('Server Owner:') + ` ${interaction.user.id === config.ownerId ? '✅ Yes' : '❌ No'}\n\n` +
                   containerStyles.bold('Required Roles:') + '\n' +
                   (config.ticketRoleId && config.ticketRoleId.length > 0 ? 
                    config.ticketRoleId.map(r => `• <@&${r}>`).join('\n') : 
                    '• Not configured') +
                   '\n\n' +
                   containerStyles.bold('Checked At:') + ` ${containerStyles.timestamp(Date.now())}`;

    await interaction.reply({
        content: content,
        flags: MessageFlags.Ephemeral
    });
}

async function handleContainerCreateButton(interaction) {
    const active = Object.values(ticketData)
        .find(t => t.userId === interaction.user.id && t.status === 'open');

    if (active) {
        return await interaction.reply({
            content: containerStyles.header('⚠️ Active Ticket Found') +
                   '\nYou already have an active ticket!\n\n' +
                   containerStyles.bold('Ticket ID:') + ` \`${active.id}\`\n` +
                   containerStyles.bold('Channel:') + ` <#${active.channelId}>\n` +
                   containerStyles.bold('Created:') + ` ${containerStyles.timestamp(active.createdAt)}\n\n` +
                   'Please close your existing ticket first.',
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.reply({
        content: containerStyles.header('🎫 Select Category') +
               '\nPlease select a category from the dropdown menu above.\n\n' +
               containerStyles.bold('Available Categories:') + '\n' +
               '• 🔧 Technical Support\n' +
               '• 💳 Payment & Billing\n' +
               '• 🤝 Reseller Program\n' +
               '• 🎬 Media & Collaboration\n' +
               '• 🔄 HWID Reset\n\n' +
               'After selection, a form will appear.',
        flags: MessageFlags.Ephemeral
    });
}

async function handleContainerInfoButton(interaction) {
    const content = containerStyles.header('ℹ️ Container System Info') +
                   containerStyles.divider() +
                   containerStyles.section('How It Works') +
                   '1. Click "Create Ticket" button\n' +
                   '2. Select category from dropdown\n' +
                   '3. Fill out the form with details\n' +
                   '4. Private container channel created\n' +
                   '5. Staff team notified automatically\n\n' +
                   containerStyles.section('Container Features') +
                   containerStyles.listItem('Private communication') +
                   containerStyles.listItem('Secure container system') +
                   containerStyles.listItem('Fast staff response') +
                   containerStyles.listItem('Transcript generation') +
                   '\n' +
                   containerStyles.section('Rules') +
                   containerStyles.listItem('One container per issue') +
                   containerStyles.listItem('No sensitive data sharing') +
                   containerStyles.listItem('Respect staff members') +
                   containerStyles.listItem('Provide detailed information') +
                   '\n' +
                   containerStyles.bold('Need help?') + ' Contact server staff.';

    await interaction.reply({
        content: content,
        flags: MessageFlags.Ephemeral
    });
}

async function handleContainerCategorySelect(interaction) {
    const selectedCategory = interaction.values[0];
    
    const categoryConfig = {
        support: { name: 'Technical Support', emoji: '🔧', questions: [
            { label: 'Username', placeholder: 'Your RurySoft username' },
            { label: 'Product/Service', placeholder: 'What product/service needs help?' },
            { label: 'Issue Description', placeholder: 'Describe your issue in detail...', style: TextInputStyle.Paragraph }
        ]},
        payment: { name: 'Payment & Billing', emoji: '💳', questions: [
            { label: 'Username', placeholder: 'Your RurySoft website username' },
            { label: 'Product Name', placeholder: 'Which product do you want?' },
            { label: 'Payment Method', placeholder: 'Credit Card / Crypto / PayPal' }
        ]},
        reseller: { name: 'Reseller Program', emoji: '🤝', questions: [
            { label: 'Username', placeholder: 'Your RurySoft username' },
            { label: 'Business Name', placeholder: 'Your business/brand name' },
            { label: 'Monthly Sales Estimate', placeholder: 'Estimated sales volume' },
            { label: 'Experience', placeholder: 'Your reseller experience...', style: TextInputStyle.Paragraph }
        ]},
        media: { name: 'Media & Collaboration', emoji: '🎬', questions: [
            { label: 'Social Media', placeholder: 'TikTok/YouTube/Instagram link' },
            { label: 'Username', placeholder: 'Your RurySoft username' },
            { label: 'Video URL', placeholder: 'Video URL (if applicable)' },
            { label: 'Proposal', placeholder: 'Collaboration proposal...', style: TextInputStyle.Paragraph }
        ]},
        hwid: { name: 'HWID Reset', emoji: '🔄', questions: [
            { label: 'Username', placeholder: 'Your RurySoft username' },
            { label: 'Product Key', placeholder: 'Enter your product key' },
            { label: 'Reset Reason', placeholder: 'Why reset needed?', style: TextInputStyle.Paragraph }
        ]}
    };

    const category = categoryConfig[selectedCategory];
    
    const modal = new ModalBuilder()
        .setCustomId(`ticket_form_${selectedCategory}`)
        .setTitle(`${category.emoji} ${category.name} Form`);

    category.questions.forEach((q, index) => {
        const textInput = new TextInputBuilder()
            .setCustomId(`q_${index}`)
            .setLabel(q.label)
            .setPlaceholder(q.placeholder)
            .setRequired(true)
            .setStyle(q.style || TextInputStyle.Short)
            .setMaxLength(q.style === TextInputStyle.Paragraph ? 1000 : 100);
        
        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    });

    await interaction.showModal(modal);
}

async function handleContainerFormSubmit(interaction) {
    const categoryKey = interaction.customId.split('_')[2];
    const user = interaction.user;
    const guild = interaction.guild;

    await interaction.reply({
        content: '🔄 Creating container channel...',
        flags: MessageFlags.Ephemeral
    });

    const ticketId = `CT-${Date.now().toString().slice(-6)}`;
    const safeName = user.username.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    const channelName = `ticket-${safeName}-${ticketId.slice(-3)}`;

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.ticketCategoryId,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
    });

    // Add staff roles
    if (config.ticketRoleId) {
        for (const roleId of config.ticketRoleId) {
            try {
                await channel.permissionOverwrites.edit(roleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
            } catch (error) {
                console.log(`Role ${roleId} error:`, error.message);
            }
        }
    }

    // Collect answers
    const categoryConfig = {
        support: { name: 'Technical Support', emoji: '🔧' },
        payment: { name: 'Payment & Billing', emoji: '💳' },
        reseller: { name: 'Reseller Program', emoji: '🤝' },
        media: { name: 'Media & Collaboration', emoji: '🎬' },
        hwid: { name: 'HWID Reset', emoji: '🔄' }
    };

    const category = categoryConfig[categoryKey];
    const answers = [];
    
    for (let i = 0; i < 4; i++) {
        const answer = interaction.fields.getTextInputValue(`q_${i}`);
        if (answer) {
            answers.push({ question: `Question ${i + 1}`, answer: answer });
        }
    }

    // Save ticket data
    ticketData[channel.id] = {
        id: ticketId,
        userId: user.id,
        userTag: user.tag,
        category: categoryKey,
        createdAt: Date.now(),
        status: 'open',
        channelId: channel.id,
        answers: answers
    };

    // Send container messages
    const ticketContainer = createTicketContainer(ticketId, user, category, answers);
    const welcomeContainer = createWelcomeContainer(user);
    
    await channel.send(ticketContainer);
    await channel.send(welcomeContainer);

    await interaction.editReply({
        content: `✅ Container created: ${channel}\nTicket ID: \`${ticketId}\``
    });

    // Log
    if (config.logChannelId) {
        try {
            const logChannel = guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const logContainer = createLogContainer('created', {
                    ticketId: ticketId,
                    userTag: user.tag,
                    userId: user.id,
                    category: category.name,
                    channel: channel.toString()
                });
                
                await logChannel.send(logContainer);
            }
        } catch (error) {
            console.log('Log error:', error.message);
        }
    }
}

async function handleContainerCloseButton(interaction) {
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];

    if (!ticket) {
        return await interaction.reply({
            content: '❌ Not a container channel!',
            flags: MessageFlags.Ephemeral
        });
    }

    const isStaff = config.ticketRoleId && config.ticketRoleId.some(roleId => 
        interaction.member.roles.cache.has(roleId)
    );

    if (!isStaff && interaction.user.id !== config.ownerId) {
        return await interaction.reply({
            content: '❌ Only staff can close containers!',
            flags: MessageFlags.Ephemeral
        });
    }

    const content = containerStyles.header('🔒 Confirm Container Closure') +
                   containerStyles.divider() +
                   containerStyles.bold('Container ID:') + ` \`${ticket.id}\`\n` +
                   containerStyles.bold('User:') + ` <@${ticket.userId}>\n` +
                   containerStyles.bold('Created:') + ` ${containerStyles.timestamp(ticket.createdAt)}\n` +
                   containerStyles.bold('Staff:') + ` ${interaction.user.tag}\n\n` +
                   containerStyles.bold('⚠️ Warning:') + '\n' +
                   'This action cannot be undone!\n' +
                   'Container will be permanently deleted.\n' +
                   'Transcript will be generated.\n\n' +
                   containerStyles.bold('Confirm closure?');

    const confirmRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('confirm_close_btn')
                .setLabel('✅ Confirm Close')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('cancel_close_btn')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.reply({
        content: content,
        components: [confirmRow],
        flags: MessageFlags.Ephemeral
    });
}

async function handleContainerCloseConfirm(interaction) {
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];

    if (!ticket) return;

    await interaction.update({
        content: '🔄 Closing container...',
        components: []
    });

    // Generate transcript
    const messages = await channel.messages.fetch({ limit: 100 });
    let transcript = `CONTAINER TRANSCRIPT - ${ticket.id}\n`;
    transcript += `User: ${ticket.userTag} (${ticket.userId})\n`;
    transcript += `Created: ${new Date(ticket.createdAt).toLocaleString()}\n`;
    transcript += `Closed: ${new Date().toLocaleString()}\n`;
    transcript += `Closed by: ${interaction.user.tag}\n\n`;
    transcript += `MESSAGES:\n${'='.repeat(50)}\n\n`;
    
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .forEach(msg => {
            transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content || '[Attachment]'}\n`;
        });

    const transcriptBuffer = Buffer.from(transcript, 'utf-8');
    const attachment = new AttachmentBuilder(transcriptBuffer, {
        name: `container-${ticket.id}-transcript.txt`
    });

    const duration = Math.floor((Date.now() - ticket.createdAt) / 60000);

    // Final message
    const closeContent = containerStyles.header('🔒 Container Closed') +
                        containerStyles.divider() +
                        containerStyles.bold('Container ID:') + ` \`${ticket.id}\`\n` +
                        containerStyles.bold('Duration:') + ` ${duration} minutes\n` +
                        containerStyles.bold('Messages:') + ` ${messages.size}\n` +
                        containerStyles.bold('Closed by:') + ` ${interaction.user.tag}\n` +
                        containerStyles.bold('Transcript:') + ' ✅ Generated\n\n' +
                        containerStyles.italic('Container will be deleted in 10 seconds...');

    await channel.send({
        content: closeContent,
        files: [attachment]
    });

    // Log
    if (config.logChannelId) {
        try {
            const logChannel = channel.guild.channels.cache.get(config.logChannelId);
            if (logChannel) {
                const logContainer = createLogContainer('closed', {
                    ticketId: ticket.id,
                    userId: ticket.userId,
                    userTag: ticket.userTag,
                    category: ticket.category,
                    createdAt: ticket.createdAt,
                    duration: duration,
                    closedBy: interaction.user.tag,
                    reason: 'Staff closed',
                    messageCount: messages.size
                });
                
                await logChannel.send({
                    ...logContainer,
                    files: [attachment]
                });
            }
        } catch (error) {
            console.log('Log error:', error.message);
        }
    }

    // Update and delete
    ticket.status = 'closed';
    ticket.closedAt = Date.now();
    ticket.closedBy = interaction.user.id;

    setTimeout(async () => {
        try {
            await channel.delete('Container closed by staff');
            delete ticketData[channel.id];
        } catch (error) {
            console.log('Delete error:', error.message);
        }
    }, 10000);
}

async function handleContainerCloseCancel(interaction) {
    await interaction.update({
        content: '✅ Container closure cancelled.',
        components: []
    });
}

async function handleContainerAddUser(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('add_user_modal')
        .setTitle('👥 Add User to Container');
    
    const input = new TextInputBuilder()
        .setCustomId('user_input')
        .setLabel('User ID or @mention')
        .setPlaceholder('Enter user ID or mention')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    
    await interaction.showModal(modal);
}

async function handleContainerTranscript(interaction) {
    await interaction.reply({
        content: '📄 Transcript feature coming soon...',
        flags: MessageFlags.Ephemeral
    });
}

client.login(process.env.DISCORD_TOKEN);
