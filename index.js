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
        console.log('No ticket roles configured or invalid format');
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

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('ticket_')) {
                return await handleCategoryButton(interaction);
            }
            if (interaction.customId === 'close_ticket') return await handleTicketClose(interaction);
            if (interaction.customId === 'confirm_close') return await handleTicketCloseConfirm(interaction);
            if (interaction.customId === 'cancel_close') return await handleTicketCloseCancel(interaction);
            if (interaction.customId === 'delete_ticket') return await handleTicketDelete(interaction);
        }

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

        // Aynı kullanıcı aktif ticket kontrolü
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

        // Components-based panel
        const panelMessage = {
            components: [
                {
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: config.categories.payment?.style || 1,
                            label: config.categories.payment?.name || 'Payment',
                            custom_id: 'ticket_payment',
                            emoji: config.categories.payment?.emoji || '💰'
                        },
                        {
                            type: 2,
                            style: config.categories.support?.style || 1,
                            label: config.categories.support?.name || 'Support',
                            custom_id: 'ticket_support',
                            emoji: config.categories.support?.emoji || '🔧'
                        },
                        {
                            type: 2,
                            style: config.categories.reseller?.style || 1,
                            label: config.categories.reseller?.name || 'Reseller',
                            custom_id: 'ticket_reseller',
                            emoji: config.categories.reseller?.emoji || '🤝'
                        }
                    ]
                },
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: config.categories.media?.style || 1,
                            label: config.categories.media?.name || 'Media',
                            custom_id: 'ticket_media',
                            emoji: config.categories.media?.emoji || '🎥'
                        },
                        {
                            type: 2,
                            style: config.categories.hwid?.style || 1,
                            label: config.categories.hwid?.name || 'HWID Reset',
                            custom_id: 'ticket_hwid',
                            emoji: config.categories.hwid?.emoji || '🆔'
                        }
                    ]
                }
            ]
        };

        // Panel mesajını gönder
        await targetChannel.send({
            content: '# 🎫 RUZYSOFT SUPPORT CENTER\nSelect a category to create a ticket:\n\n⚠️ **Please provide all required information. Incomplete tickets will be closed automatically!**',
            components: panelMessage.components
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

        // Get user's answers
        const answers = [];
        for (let i = 0; i < 4; i++) {
            const answer = interaction.fields.getTextInputValue(`question_${i}`);
            if (answer) answers.push(answer);
        }

        const ticketId = `ticket-${Date.now().toString().slice(-6)}`;
        const safeName = user.username.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 20);
        const channelName = `ticket-${safeName}-${ticketId.slice(-6)}`;

        console.log(`Creating ticket for ${user.tag} with ID: ${ticketId}`);
        
        const channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            topic: `Ticket ID: ${ticketId} | User: ${user.tag} | Category: ${category.name}`,
            reason: `Ticket created by ${user.tag}`
        });

        console.log(`Channel created: ${channel.id}`);

        // Store ticket data
        ticketData[channel.id] = {
            id: ticketId,
            userId: user.id,
            username: user.username,
            userTag: user.tag,
            category: categoryKey,
            categoryName: category.name,
            createdAt: Date.now(),
            status: 'open',
            channelId: channel.id,
            answers: answers
        };

        // Set permissions
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

            // Add support roles
            if (config.ticketRoleId && Array.isArray(config.ticketRoleId)) {
                for (const roleId of config.ticketRoleId) {
                    if (!roleId || typeof roleId !== 'string') continue;
                    
                    try {
                        const role = await guild.roles.fetch(roleId);
                        if (role) {
                            await channel.permissionOverwrites.edit(roleId, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true,
                                ManageMessages: true,
                                AttachFiles: true,
                                EmbedLinks: true
                            });
                        }
                    } catch (roleError) {
                        console.log(`Role ${roleId} error:`, roleError.message);
                    }
                }
            }

        } catch (permError) {
            console.log('Permission error:', permError.message);
        }

        // Create category-specific info
        let categoryInfo = '';
        switch (categoryKey) {
            case 'payment':
                categoryInfo = `**Username:** ${answers[0]}\n**Product:** ${answers[1]}\n**Payment Method:** ${answers[2]}`;
                break;
            case 'support':
                categoryInfo = `**Username:** ${answers[0]}\n**Product/Service:** ${answers[1]}\n**Issue:** ${answers[2]}`;
                break;
            case 'reseller':
                categoryInfo = `**Username:** ${answers[0]}\n**Business:** ${answers[1]}\n**Monthly Sales:** ${answers[2]}\n**Experience:** ${answers[3]}`;
                break;
            case 'media':
                categoryInfo = `**Social Media:** ${answers[0]}\n**Username:** ${answers[1]}\n**Video URL:** ${answers[2]}\n**Proposal:** ${answers[3]}`;
                break;
            case 'hwid':
                categoryInfo = `**Username:** ${answers[0]}\n**Product Key:** ${answers[1]}\n**Reason:** ${answers[2]}`;
                break;
        }

        // Ticket açılış mesajı
        const ticketMessage = {
            content: `# 🎫 RUZYSOFT TICKET\n\n**Ticket ID:** ${ticketId}\n**User:** ${user} (${user.tag})\n**Category:** ${category.emoji} ${category.name}\n**Opened with:** ${category.name} Button\n\n${categoryInfo}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n👋 **Welcome!** Please describe your inquiry below. Our support team will assist you shortly.`,
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: ButtonStyle.Primary,
                            label: 'Close Ticket',
                            emoji: '🔒',
                            custom_id: 'close_ticket'
                        },
                        {
                            type: 2,
                            style: ButtonStyle.Danger,
                            label: 'Delete Ticket',
                            emoji: '🗑️',
                            custom_id: 'delete_ticket'
                        }
                    ]
                }
            ]
        };

        await channel.send(ticketMessage);
        
        // Mention support roles if configured
        if (config.ticketRoleId && Array.isArray(config.ticketRoleId) && config.ticketRoleId.length > 0) {
            const roleMentions = config.ticketRoleId.map(id => `<@&${id}>`).join(' ');
            await channel.send({
                content: `${roleMentions}\n📢 New ticket created!`,
                allowedMentions: { roles: config.ticketRoleId }
            });
        }

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

        // Confirmation buttons
        const confirmButtons = new ActionRowBuilder()
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
            content: `# ⚠️ CONFIRM TICKET CLOSURE\n\n**Ticket ID:** ${ticket.id}\n**User:** <@${ticket.userId}>\n**Category:** ${ticket.categoryName}\n**Closed by:** ${interaction.user}\n\n⚠️ **This action cannot be undone!**\nThe channel will be archived and deleted.`,
            components: [confirmButtons],
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

        // Close notification
        const duration = Math.floor((Date.now() - ticket.createdAt) / (1000 * 60));
        const hours = Math.floor(duration / 60);
        const minutes = duration % 60;
        
        const closeMessage = {
            content: `# 🔒 TICKET CLOSED\n\n**Ticket ID:** ${ticket.id}\n**User:** <@${ticket.userId}>\n**Closed by:** ${interaction.user}\n**Duration:** ${hours > 0 ? `${hours}h ` : ''}${minutes}m\n\n📁 *This channel will be deleted in 10 seconds...*`
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
        console.error('Error in handleTicketCloseConfirm:', error);
        await interaction.followUp({
            content: '❌ Error closing ticket!',
            flags: MessageFlags.Ephemeral
        });
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
