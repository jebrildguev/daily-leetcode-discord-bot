import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import https from 'https';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest, getDailyLeetCode, sendToDiscord } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import {
  CHALLENGE_COMMAND,
  TEST_COMMAND,
  HasGuildCommands,
} from './commands.js';
import { CommandExecutor } from './commandExecutor.js';
import yaml from 'js-yaml';
import fs from 'fs';
import { MessageEmbed } from 'discord.js';


// Create an express app
const app = express(); 
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Load config values from yml
const config = yaml.load(fs.readFileSync('config.yml', 'utf8'));
 
// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

/**
 * Schedules a crons jobb
 */
/** 
cron.schedule('0 7 * * *', async function() 
*/

app.get('/dailyLeetCode', async function (req, res) {
  const DAILY_CODING_CHALLENGE_QUERY = `
  query questionOfToday {
    activeDailyCodingChallengeQuestion {
      date
      link
      question {
        acRate
        difficulty
        frontendQuestionId: questionFrontendId
        title
        topicTags {
          name
          id
          slug
        }
      }
    }
  }`;

  const leetCodeOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: DAILY_CODING_CHALLENGE_QUERY }),
  };
  const leetcodeResponse = await getDailyLeetCode(config.leetcode.baseUrl + '/graphql', leetCodeOptions);

  console.debug(leetcodeResponse);

  let topicTags = [];
  leetcodeResponse.data.activeDailyCodingChallengeQuestion.question.topicTags.forEach(element => {
    topicTags.push(element.name);
  });
  
  const leetcodeEmbed = new MessageEmbed()
    .setColor('#0099ff')
    .setTitle('Daily Leetcode Challenge: ' + leetcodeResponse.data.activeDailyCodingChallengeQuestion.question.frontendQuestionId + ' - ' + leetcodeResponse.data.activeDailyCodingChallengeQuestion.question.title)
    .setURL(config.leetcode.baseUrl + leetcodeResponse.data.activeDailyCodingChallengeQuestion.link)
    .addFields( 
      { name: 'Difficulty', value: leetcodeResponse.data.activeDailyCodingChallengeQuestion.question.difficulty, inline: true },
      { name: 'Topic tags', value: topicTags.join(", "), inline: true },
    );
  
  const discordOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify({ 
      username: 'daily-leetcode-publisher',
      embeds: [ leetcodeEmbed ]
    })
  };

  const discordResponse = await sendToDiscord(config.discord.webhooks.url + process.env.WEB_HOOK_ID_DEV + '/' + process.env.WEB_HOOK_TOKEN_DEV, discordOptions);
  if (discordResponse.ok) {
    res.sendStatus(200);
  } else { // TODO: what exceptions could be thrown? 
    res.sendStatus(500);
  }
   
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
// TODO: Migrate all these commands into command executor - will use command design pattern.
app.post('/interactions', async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    // "test" guild command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }
    // "challenge" guild command
    if (name === 'challenge' && id) {
      const userId = req.body.member.user.id;
      // User's object choice
      const objectName = req.body.data.options[0].value;

      // Create active game using message ID as the game ID
      activeGames[id] = {
        id: userId,
        objectName,
      };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: `Rock papers scissors challenge from <@${userId}>`,
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  // Append the game ID to use later on
                  custom_id: `accept_button_${req.body.id}`,
                  label: 'Accept',
                  style: ButtonStyleTypes.PRIMARY,
                },
              ],
            },
          ],
        },
      });
    }
  }

  /**
   * Handle requests from interactive components
   * See https://discord.com/developers/docs/interactions/message-components#responding-to-a-component-interaction
   */
  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    const componentId = data.custom_id;

    if (componentId.startsWith('accept_button_')) {
      // get the associated game ID
      const gameId = componentId.replace('accept_button_', '');
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: 'What is your object of choice?',
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Append game ID
                    custom_id: `select_choice_${gameId}`,
                    options: getShuffledOptions(),
                  },
                ],
              },
            ],
          },
        });
        // Delete previous message
        await DiscordRequest(endpoint, { method: 'DELETE' });
      } catch (err) {
        console.error('Error sending message:', err);
      }
    } else if (componentId.startsWith('select_choice_')) {
      // get the associated game ID
      const gameId = componentId.replace('select_choice_', '');

      if (activeGames[gameId]) {
        // Get user ID and object choice for responding user
        const userId = req.body.member.user.id;
        const objectName = data.values[0];
        // Calculate result from helper function
        const resultStr = getResult(activeGames[gameId], {
          id: userId,
          objectName,
        });

        // Remove game from storage
        delete activeGames[gameId];
        // Update message with token in request body
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

        try {
          // Send results
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: resultStr },
          });
          // Update ephemeral message
          await DiscordRequest(endpoint, {
            method: 'PATCH',
            body: {
              content: 'Nice choice ' + getRandomEmoji(),
              components: [],
            },
          });
        } catch (err) {
          console.error('Error sending message:', err);
        }
      }
    }
  }
});

app.listen(3000, () => {
  console.log('Listening on port 3000');

  // Check if guild commands from commands.json are installed (if not, install them)
  HasGuildCommands(process.env.APP_ID, process.env.GUILD_ID, [
    TEST_COMMAND,
    CHALLENGE_COMMAND,
  ]);
});
