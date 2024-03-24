import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { twitchReconnect } from '../src/utils/reloadManager.js';
import { eventList } from '../src/utils/dbManager.js';
import { eventSummaryData, eventSummaryMessage, getClips } from '../src/utils/twitchAPI.js';
import { env } from "custom-env";
env();

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('commands related to twitch')
        .addSubcommand(subcommand => subcommand.setName('reconnect').setDescription('reconnect to EventSub API'))
        .addSubcommand(subcommand => subcommand.setName('summary').setDescription('show a summary of the past month or until the specified time')
            .addStringOption(option => option.setName('time').setDescription('time frame (12d 15h 5m)').setMaxLength(16)
            ))
        .addSubcommand(subcommand => subcommand.setName('events').setDescription('get your saved event data')
            .addStringOption(option => option.setName('eventname').setDescription('event type').setRequired(true)
                .addChoices(
                    { name: 'Subscribe', value: 'subscribe' },
                    { name: 'Giftsub', value: 'giftsub' },
                    { name: 'Bits', value: 'bits' }
                )))
        .addSubcommand(subcommand => subcommand.setName('get').setDescription('get data from the twitch API')
            .addStringOption(option => option.setName('endpoint').setDescription('data type').setRequired(true)
                .addChoices(
                    { name: 'Clips', value: 'clips' }
                ))
            .addStringOption(option => option.setName('time').setDescription('time frame (12d 15h 5m)').setMaxLength(16).setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {

        if (!JSON.parse(process.env.TRUSTED).includes(interaction.user.id)) return interaction.reply('This command is not available for public usage.');

        /**
         * Manually triggers a full reconnect of the Twitch EventSub WebSocket.
         */
        if (interaction.options.getSubcommand() === 'reconnect') {
            await interaction.reply({ content: `<a:AriliaLOADING:1221055537534210078>`, ephemeral: true });
            if (await twitchReconnect(interaction.client)) interaction.editReply({ content: `Successfully reconnected.`, ephemeral: true });
            return;
        }

        /**
         * The summary subcommand sums up the names of all event contributors from the past month if no 'time' option is specified,
         * or from now searching back by the 'time' interval if specified.
         * In the second case, results are limited to the current month.
         */
        if (interaction.options.getSubcommand() === 'summary') {
            await interaction.deferReply({ ephemeral: true });

            if (!interaction.options.getString('time')) {
                const pastMonth = eventSummaryMessage(eventList[0].events);
                pastMonth[0].title = `Event summary of ${monthNames[eventList[0].month]}`;
                interaction.editReply({ embeds: pastMonth, ephemeral: true });
                return;
            }

            let timeFrame = 0;
            const complexTime = interaction.options.getString('time').split(' ');
            for (const subTime of complexTime) {
                if (ms(subTime)) {
                    timeFrame += ms(subTime);
                }
                else return interaction.reply({ content: 'Not a valid time', ephemeral: true });
            }
            if (timeFrame > 2419200000) return interaction.reply({ content: 'Choose a time less than 4 weeks in the past.', ephemeral: true });

            const timeNow = Date.now();
            const dateNow = new Date(timeNow);
            const beginningOfMonth = new Date(dateNow.getFullYear(), dateNow.getMonth(), 1);
            const timeDiff = timeNow - beginningOfMonth.getTime();

            const embeds = eventSummaryMessage(eventList[1].events, timeNow - timeFrame);
            if (timeFrame > timeDiff) embeds[0].title = `Event summary of ${monthNames[eventList[1].month]}`;
            else embeds[0].title = `Event summary of the past ${ms(timeFrame)}`;
            interaction.editReply({ embeds: embeds, ephemeral: true });
            return;
        }

        /**
         * The 'events' subcommand compiles collected data on the given event type, specified by the 'eventname' option.
         */
        if (interaction.options.getSubcommand() === 'events') {
            await interaction.deferReply({ ephemeral: true });
            const eventName = interaction.options.getString('eventname');
            const months = await getEvent(eventName);
            const embed = await getEmbed(eventName, months);
            interaction.editReply({ embeds: [embed], ephemeral: true });
            return;
        }

        /**
         * The 'get' subcommand is meant to be used for fetching and processing any kind of data from the Twitch Helix API.
         * The desired endpoint and kind of the data is determined by the 'endpoint' option.
         */
        if (interaction.options.getSubcommand('get')) {
            let timeFrame = 0;
            const complexTime = interaction.options.getString('time').split(' ');
            for (const subTime of complexTime) {
                if (ms(subTime)) {
                    timeFrame += ms(subTime);
                }
                else return interaction.reply({ content: 'Not a valid time', ephemeral: true });
            }
            if (timeFrame > 4838400000) return interaction.reply({ content: 'Choose a time less than 8 weeks in the past.', ephemeral: true });

            await interaction.deferReply({ ephemeral: true });

            if (interaction.options.getString('endpoint') === 'clips') {

                let clips;
                try {
                    clips = await getClips(Date.now() - timeFrame);
                } catch (error) {
                    console.error('Twitch API error Failed getting clips:', error);
                    return interaction.editReply({ content: `Couldn't get clips from twitch API.`, ephemeral: true });
                }

                const response = await interaction.editReply({
                    content: `I found ${clips.length} clips from that timeframe.\nDo you want to post them?`,
                    components: [await addMessageActions('Yes please', 'No thank you')],
                    ephemeral: true
                });
                const confirmation = await manageMessageActions(response, interaction.user.id);
                if (!confirmation) return interaction.editReply({ content: 'Command ended due to inactivity', components: [], ephemeral: true });
                /* // example scenario
                interaction.editReply({ content: `posting clips...`, ephemeral: true });
                const clipsPromises = [];
                for (const clip of clips) {
                    try {
                        clipsPromises.push(clipsChannel.send(clip));    
                    } catch (error) { 
                    }
                }
                await Promise.all(clipsPromises);
                interaction.editReply({ content: `Completed posting ${clips.length} clips in <#${clipsChannel.id}>.`, ephemeral: true });
                */
            }
            else {

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

/**
 * Constructs an embed based on the provided event data and returns it.
 * 
 * @param {string} eventName Name of the requested event type.
 * @param {any[]} months Array containing the compiled event data for the last and current month.
 * @returns {Promise<EmbedBuilder>} The completed embed, ready to be sent.
 */
async function getEmbed(eventName, months) {
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
        Object.entries(month).forEach(([, value]) => {
            string += `${value.name}: ${value.data}\n`;
        });
        return string;
    }
}

/**
 * Retrieves and processes the stored data on the given event and returns it in a format that can easily be iterated on to add the processed data to the reply embed.
 * 
 * @param {string} eventName Name of the requested event type.
 * @returns {Promise<any[]>} Array with the object containing the event data for the last month at index 0,
 * the object with the data for the current month at index 1, and a string representing the description to be set in the reply embed.
 */
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
            description = "\`\`Note: Bits event isn't processed if anonymous or if amount is < 100.\`\`";
            if (eventList[0].events.hasOwnProperty(eventName)) await countBits(eventName, 0, lastMonth);
            if (eventList[1].events.hasOwnProperty(eventName)) await countBits(eventName, 1, currentMonth);
            break;
        default:
            break;
    }
    return [lastMonth, currentMonth, description];
}

/**
 * Mutates the given month object directly by adding the tiercounts and top contributors.
 * 
 * @param {string} eventName Name of the requested event type.
 * @param {number} i 0 for last month or 1 for currentMonth.
 * @param {Object} month The month object to add the tier count to.
 * @param {boolean} giftsub Wether the event is a subscription or giftsub event.
 */
async function countSubTiers(eventName, i, month, giftsub) {
    const tierCounts = eventList[i].events[eventName].reduce((acc, event) => {
        if (event.tier === 1000) {
            if (giftsub) {
                acc.tier1 += event.amount;
                return acc;
            }
            acc.tier1++;
        } else if (event.tier === 2000) {
            if (giftsub) {
                acc.tier2 += event.amount;
                return acc;
            }
            acc.tier2++;
        } else if (event.tier === 3000) {
            if (giftsub) {
                acc.tier3 += event.amount;
                return acc;
            }
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
    const summaryData = eventSummaryData(eventList[i].events[eventName]);
    if (!summaryData) return;
    month.top = {
        name: giftsub ? 'Top Sub Gifters' : 'Top Subscribers',
        data: `*${summaryData.slice(0, 10).join(', ')}*`
    }
}

/**
 * Mutates the given month object directly by adding the total bits amount and top contributors.
 * 
 * @param {string} eventName Name of the requested event type.
 * @param {} i 0 for last month or 1 for currentMonth.
 * @param {Object} month The month object to add the tier count to.
 */
async function countBits(eventName, i, month) {
    const bitCount = eventList[i].events[eventName].reduce((acc, event) => {
        return acc += event.amount;
    }, 0);
    month.total = {
        name: 'Total Bits',
        data: bitCount
    }
    const summaryData = eventSummaryData(eventList[i].events[eventName]);
    if (!summaryData) return;
    month.top = {
        name: 'Top Cheerers',
        data: `*${summaryData.slice(0, 10).join(', ')}*`
    }
}

/**
 * A reduced implementation of the 'ms' npm module that fits the needs of this command.
 * 
 * @param {string | number} time A time string consisting of a number and character of (w|d|h|m|s), or a number representing milliseconds.
 * @returns {string | number | undefined} If a string is passed as argument, returns the number of milliseconds the string represents.
 * If a number is passed as argument, returns a string representing the time interval equivalent to the number in milliseconds.
 */
function ms(time) {

    const s = 1000;
    const m = s * 60;
    const h = m * 60;
    const d = h * 24;
    const w = d * 7;

    if (typeof (time) === 'number') {
        if (time >= d) return time >= d * 1.5 ? `${Math.round(time / d)} days` : `${Math.round(time / d)} day`;
        if (time >= h) return time >= h * 1.5 ? `${Math.round(time / h)} hours` : `${Math.round(time / h)} hour`;
        if (time >= m) return time >= m * 1.5 ? `${Math.round(time / m)} minutes` : `${Math.round(time / m)} minute`;
        if (time >= s) return time >= s * 1.5 ? `${Math.round(time / s)} seconds` : `${Math.round(time / s)} second`;
        return time + ' ms';
    }

    const match = /^((?:\d+)?\.?\d+) *(s|m|h|d|w)?$/i.exec(time);
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