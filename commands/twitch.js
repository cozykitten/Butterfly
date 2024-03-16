import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { twitchReconnect } from '../src/utils/reloadManager.js';
import { eventList } from '../src/utils/dbManager.js';
import { getClips, getFollowers } from '../src/utils/twitchAPI.js';
import { env } from "custom-env";
env();


export default {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('commands related to twitch')
        .addSubcommand(subcommand => subcommand.setName('reconnect').setDescription('reconnect to EventSub API'))
        .addSubcommand(subcommand => subcommand.setName('events').setDescription('get your saved event data')
            .addStringOption(option => option.setName('eventname').setDescription('event type').setRequired(true)
                .addChoices(
                    { name: 'Follow', value: 'follow' },
                    { name: 'Subscribe', value: 'subscribe' },
                    { name: 'Giftsub', value: 'giftsub' },
                    { name: 'Bits', value: 'bits' },
                    { name: 'Hypetrain', value: 'hypetrain' },
                    { name: 'Redeem', value: 'redeem' }
                )))
        .addSubcommand(subcommand => subcommand.setName('get').setDescription('get data from the twitch API')
            .addStringOption(option => option.setName('endpoint').setDescription('data type').setRequired(true)
                .addChoices(
                    { name: 'Followers', value: 'followers' },
                    { name: 'Clips', value: 'clips' }
                ))
            .addStringOption(option => option.setName('time').setDescription('time frame (12d 15h 5m)').setMaxLength(16).setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {

        if (!JSON.parse(process.env.TRUSTED).includes(interaction.user.id)) return interaction.reply('This command is not available for public usage.');

        if (interaction.options.getSubcommand() === 'reconnect') {
            await interaction.reply({ content: `reconnecting...`, ephemeral: true });
            if (await twitchReconnect(interaction.client)) interaction.editReply({ content: `Successfully reconnected.`, ephemeral: true });
            return;
        }

        if (interaction.options.getSubcommand() === 'events') {
            await interaction.deferReply({ ephemeral: true });
            const eventName = interaction.options.getString('eventname');
            const months = await getEvent(eventName);
            const embed = await getEmbed(eventName, months);
            interaction.editReply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (interaction.options.getSubcommand('get')) {
            let timeFrame = 0;
            const complexTime = interaction.options.getString('time').split(' ');
            for (const subTime of complexTime) {
                if (ms(subTime)) {
                    timeFrame += ms(subTime);
                }
                else return interaction.reply({ content: 'not a valid time', ephemeral: true });
            }
            if (timeFrame > 4838400000) return interaction.reply({ content: 'Choose a time less than 8 weeks in the past.', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            if (interaction.options.getString('endpoint') === 'clips') {
                try {
                    const clips = await getClips(Date.now() - timeFrame);
                    const response = await interaction.editReply({
                        content: `I found ${clips.length} clips from that timeframe.\nWhat do you want me to do with them?`,
                        components: [await addMessageActions('Yes please', 'No thank you')],
                        ephemeral: true
                    });
                    const confirmation = await manageMessageActions(response, interaction.user.id);
                    if (!confirmation) interaction.editReply({ content: 'Command ended due to inactivity', components: [], ephemeral: true });
                } catch (error) {
                    console.error('Twitch API error Failed getting clips:', error);
                    return interaction.editReply({ content: `Couldn't get clips from twitch API.`, ephemeral: true });
                }
            }
            else {
                try {
                    //const followers = await getFollowers(Date.now() - timeFrame);
                    const followerCount = await getFollowers(Date.now() - timeFrame);
                    const response = await interaction.editReply({
                        content: `${followerCount/*followers.length*/} people started following you in that timeframe.`,
                        ephemeral: true
                    });
                    //const confirmation = await manageMessageActions(response, interaction.user.id);
                    //if (!confirmation) interaction.editReply({ content: 'Command ended due to inactivity', components: [], ephemeral: true });
                } catch (error) {
                    console.error('Twitch API error Failed getting followers:', error);
                    return interaction.editReply({ content: `Couldn't get follower data from twitch API.`, ephemeral: true });
                }
            }
        }
    }
}

async function addMessageActions(first, second) {
    const confirm = new ButtonBuilder()
        .setCustomId('confirm')
        .setLabel(first)
        .setStyle(ButtonStyle.Primary);

    const cancel = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel(second)
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(confirm, cancel);
}

async function manageMessageActions(response, userId) {
    const collectorFilter = i => i.user.id === userId;

    try {
        const confirmation = await response.awaitMessageComponent({ filter: collectorFilter, time: 15000 });

        if (confirmation.customId === 'confirm') {
            await confirmation.update({ content: '...', components: [], ephemeral: true });
            /* ... */
            return true;
        } else if (confirmation.customId === 'cancel') {
            confirmation.update({ content: 'Alright!', components: [], ephemeral: true });
            return true;
        }
    } catch (e) {
        return false;
    }
}

async function getEmbed(eventName, months) {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let lastMonthField = getFieldString(months[0]);
    let currentMonthField = getFieldString(months[1]);

    const embed = new EmbedBuilder()
        .setTitle(`Event data for ${eventName} event`)
        .setColor(0xFE676E)
        .setDescription(months[2])
        .setFields(
            { name: monthNames[eventList[0].month], value: lastMonthField, inline: true },
            { name: monthNames[eventList[1].month], value: currentMonthField, inline: true }
        );
    return embed;


    function getFieldString(month) {
        let string = '';
        for (const key in month) {
            if (key === 'redeems') {
                for (const title in month.redeems) {
                    string += `${title}: ${month.redeems[title]}\n`;
                }
                continue;
            }
            string += `${month[key].name}: ${month[key].data}\n`;
        }
        return string;
    }
}

async function getEvent(eventName) {
    const lastMonth = {
        count: {
            name: 'Event count',
            data: eventList[0].events.hasOwnProperty(eventName) ? eventList[0].events[eventName].length : 0
        }
    }
    const currentMonth = {
        count: {
            name: 'Event count',
            data: eventList[1].events.hasOwnProperty(eventName) ? eventList[1].events[eventName].length : 0
        }
    }
    let description = null;

    switch (eventName) {
        case "follow":
            break;
        case "subscribe":
            description = "\`\`Note: Subscribe event isn't processed if the sub was gifted.\`\`"
            if (eventList[0].events.hasOwnProperty(eventName)) await countSubTiers(eventName, 0, lastMonth);
            if (eventList[1].events.hasOwnProperty(eventName)) await countSubTiers(eventName, 1, currentMonth);
            break;
        case "giftsub":
            description = "\`\`Note: Giftsub event isn't processed if anonymous.\`\`"
            if (eventList[0].events.hasOwnProperty(eventName)) await countSubTiers(eventName, 0, lastMonth, true);
            if (eventList[1].events.hasOwnProperty(eventName)) await countSubTiers(eventName, 1, currentMonth, true);
            break;
        case "bits":
            description = "\`\`Note: Bits event isn't processed if anonymous.\`\`";
            if (eventList[0].events.hasOwnProperty(eventName)) await countBits(eventName, 0, lastMonth);
            if (eventList[1].events.hasOwnProperty(eventName)) await countBits(eventName, 1, currentMonth);
            break;
        case "hypetrain":
            if (eventList[0].events.hasOwnProperty(eventName)) await trainCount(eventName, 0, lastMonth);
            if (eventList[1].events.hasOwnProperty(eventName)) await trainCount(eventName, 1, currentMonth);
            break;
        case "redeem":
            if (eventList[0].events.hasOwnProperty(eventName)) await countRedeems(eventName, 0, lastMonth);
            if (eventList[1].events.hasOwnProperty(eventName)) await countRedeems(eventName, 1, currentMonth);
            break;
        default:
            break;
    }
    return [lastMonth, currentMonth, description];
}

/**
 * Mutates the given month object directly by adding the tiercounts.
 * @param {string} eventName name of the event
 * @param {number} i 0 for last month or 1 for currentMonth
 * @param {Object} month the month object to add the tier count to.
 * @param {boolean} giftsub wether the event is a subscription or giftsub event.
 */
async function countSubTiers(eventName, i, month, giftsub) {
    const tierCounts = eventList[i].events[eventName].reduce((acc, event) => {
        if (event.tier === 1000) {
            if (giftsub) return acc.tier1 += event.amount;
            acc.tier1++;
        } else if (event.tier === 2000) {
            if (giftsub) return acc.tier2 += event.amount;
            acc.tier2++;
        } else if (event.tier === 3000) {
            if (giftsub) return acc.tier3 += event.amount;
            acc.tier3++;
        }
        return acc;
    }, { tier1: 0, tier2: 0, tier3: 0 });
    month.tier1 = {
        name: 'Tier 1 Subs',
        data: tierCounts.tier1
    }
    month.tier2 = {
        name: 'Tier 2 Subs',
        data: tierCounts.tier2
    }
    month.tier3 = {
        name: 'Tier 3 Subs',
        data: tierCounts.tier3
    }
}

async function countBits(eventName, i, month) {
    const bitCount = eventList[i].events[eventName].reduce((acc, event) => {
        return acc += event.amount;
    }, 0);
    month.total = {
        name: 'Total Bits',
        data: bitCount
    }
}

async function countRedeems(eventName, i, month) {
    const titleCount = eventList[i].events[eventName].reduce((acc, event) => {
        acc[event.title] = (acc[event.title] || 0) + 1;
        return acc;
    }, {});
    month.redeems = titleCount;
}

async function trainCount(eventName, i, month) {
    const bitCount = eventList[i].events[eventName].reduce((acc, event) => {
        if (!event.bitCount) return acc;
        return acc += event.bitCount;
    }, 0);
    month.totalBits = {
        name: 'Total Bits',
        data: bitCount
    }

    const subCount = eventList[i].events[eventName].reduce((acc, event) => {
        if (!event.subCount) return acc;
        return acc += event.subCount;
    }, 0);
    month.totalSubs = {
        name: 'Total Subs',
        data: subCount
    }
}

function ms(str) {
    const s = 1000;
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;

    const match = /^((?:\d+)?\.?\d+) *(s|m|h|d|w)?$/i.exec(str);
    if (!match) return undefined;

    const n = parseFloat(match[1]);
    const type = (match[2] || 'ms').toLowerCase();

    switch (type) {
        case 'w':
            return n * w;
        case 'd':
            return n * d;
        case 'h':
            return n * h;
        case 'm':
            return n * m;
        case 's':
            return n * s;
        case 'ms':
            return n;
        default:
            return undefined;
    }
}