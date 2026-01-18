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

// Hata yakalama
client.on('error', console.error);
process.on('unhandledRejection', console.error);

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
        }
    ];

    for (const cmd of commands) {
        await guild.commands.create(cmd);
    }

    console.log('✨ Premium commands loaded!');
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ticketpanel')
                return handleTicketCommand(interaction);
            if (interaction.commandName === 'logchannel')
                return handleLogSetup(interaction);
            if (interaction.commandName === 'resetlogs')
                return handleLogReset(interaction);
            if (interaction.commandName === 'ticketstats')
                return handleTicketStats(interaction);
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category')
            return handleCategorySelection(interaction);

        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_'))
            return handleModalSubmit(interaction);

        if (interaction.isButton()) {
            if (interaction.customId === 'close_ticket') return handleTicketClose(interaction);
            if (interaction.customId === 'confirm_close') return handleTicketCloseConfirm(interaction);
            if (interaction.customId === 'cancel_close') return handleTicketCloseCancel(interaction);
        }
    } catch (error) {
        console.error('Interaction error:', error);
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
        .setThumbnail('https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png')
        .setImage('https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png')
        .setFooter({ 
            text: 'RuzySoft Revolution • Premium Cheat Solutions',
            iconURL: 'https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png'
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
    try {
        const categoryKey = interaction.customId.split('_')[2];
        const category = config.categories[categoryKey];
        const guild = interaction.guild;
        const user = interaction.user;

        // İlk mesaj
        await interaction.reply({
            content: '🔄 Creating your ticket...',
            flags: MessageFlags.Ephemeral
        });

        const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
        const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '');
        const channelName = `${category.emoji}-${safeName}`;

        // 1. ÖNCE KANALI OLUŞTUR (sadece temel ayarlarla)
        const channel = await guild.channels.create({
            name: channelName.substring(0, 100), // Discord max 100 karakter
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            topic: `Ticket ID: ${ticketId}`,
            reason: `Ticket created by ${user.tag}`
        });

        console.log(`Channel created: ${channel.id}`);

        // 2. VERİLERİ KAYDET
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

        // 3. İZİNLERİ AYARLA (SIRALI ve BASİT)
        const everyone = guild.id;
        const bot = client.user.id;

        // a) @everyone için ViewChannel'ı kapat
        await channel.permissionOverwrites.create(everyone, {
            ViewChannel: false
        });

        // b) Bot'a gerekli izinleri ver
        await channel.permissionOverwrites.create(bot, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageMessages: true,
            ManageChannels: true
        });

        // c) Kullanıcıya izin ver
        await channel.permissionOverwrites.create(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true
        });

        // d) Staff rollerine izin ver
        if (config.ticketRoleId && Array.isArray(config.ticketRoleId)) {
            for (const roleId of config.ticketRoleId) {
                try {
                    const role = await guild.roles.fetch(roleId);
                    if (role) {
                        await channel.permissionOverwrites.create(roleId, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true,
                            ManageMessages: true
                        });
                    }
                } catch (roleError) {
                    console.log(`Could not add role ${roleId}:`, roleError.message);
                }
            }
        }

        // 4. TICKET EMBED'İ OLUŞTUR
        const ticketEmbed = new EmbedBuilder()
            .setTitle(`${category.emoji} ${category.name} Ticket`)
            .setDescription(
                `**Ticket ID:** \`${ticketId}\`\n` +
                `**User:** ${user} (${user.tag})\n` +
                `**Category:** ${category.name}\n` +
                `**Created:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                `**Status:** 🟢 **OPEN**\n\n` +
                `**📋 Ticket Information:**\n` +
                `Our support team will assist you shortly. Please be patient.`
            )
            .setColor('#5865F2')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: 'RuzySoft Premium Support',
                iconURL: 'https://cdn.discordapp.com/attachments/1462207492275572883/1462253410752659647/6e357873-fb9e-43a5-94fe-ccbaa12c56e2.png'
            })
            .setTimestamp();

        // 5. SORU-CEVAPLARI EKLE
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

        // 6. BUTONLARI OLUŞTUR
        const buttonRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Close Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        // 7. MESAJ GÖNDER
        try {
            // Welcome mesajı
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

            await channel.send({ embeds: [welcomeEmbed] });

            // Ana ticket mesajı
            let mentionText = '';
            if (config.ticketRoleId && config.ticketRoleId.length > 0) {
                mentionText = config.ticketRoleId.map(r => `<@&${r}>`).join(' ');
            }

            await channel.send({
                content: `${user} ${mentionText}`,
                embeds: [ticketEmbed],
                components: [buttonRow]
            });

            // 8. İLK MESAJI GÜNCELLE
            await interaction.editReply({
                content: `✅ Ticket created successfully: ${channel}`
            });

            // 9. LOG KANALINA BİLDİR
            if (config.logChannelId && config.logChannelId !== "") {
                try {
                    const logChannel = guild.channels.cache.get(config.logChannelId);
                    if (logChannel) {
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
                } catch (logError) {
                    console.log('Log error (non-critical):', logError.message);
                }
            }

        } catch (sendError) {
            console.error('Error sending messages:', sendError);
            await interaction.editReply({
                content: `✅ Ticket created but there was an error sending messages: ${sendError.message}`
            });
        }

    } catch (error) {
        console.error('Fatal error in handleModalSubmit:', error);
        
        let errorMsg = '❌ Error creating ticket! ';
        if (error.code === 50013) {
            errorMsg += 'Bot lacks permissions. Please make sure bot has: Manage Channels, Manage Roles, Manage Messages permissions.';
        } else if (error.code === 50001) {
            errorMsg += 'Bot cannot access the channel.';
        } else {
            errorMsg += error.message;
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
    const channel = interaction.channel;
    const ticket = ticketData[channel.id];

    if (!ticket) {
        return interaction.reply({
            content: '❌ This is not a ticket channel!',
            flags: MessageFlags.Ephemeral
        });
    }

    const isStaff = hasSupportPermission(interaction.member);
    const isOwner = interaction.user.id === config.ownerId;
    const isTicketOwner = interaction.user.id === ticket.userId;

    if (!isStaff && !isOwner && !isTicketOwner) {
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
            `⚠️ Channel will be deleted after closing.`
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
        content: '🔄 Closing ticket...',
        embeds: [],
        components: []
    });

    try {
        // Simple close embed
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(
                `This ticket has been closed by ${interaction.user}\n\n` +
                `*Channel will be deleted in 5 seconds...*`
            )
            .setColor('#ff0000')
            .setTimestamp();
        
        await channel.send({ embeds: [closeEmbed] });
        
        // Update ticket data
        ticket.status = 'closed';
        ticket.closedAt = Date.now();
        ticket.closedBy = interaction.user.id;
        
        // Wait and delete
        setTimeout(async () => {
            try {
                await channel.delete('Ticket closed');
                delete ticketData[channel.id];
            } catch (deleteError) {
                console.error('Error deleting channel:', deleteError);
            }
        }, 5000);
        
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

client.login(process.env.DISCORD_TOKEN);
