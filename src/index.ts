import * as core from '@actions/core'
import { App, BlockAction, LogLevel } from '@slack/bolt'
import { WebClient } from '@slack/web-api'
import { randomUUID } from 'crypto'

const token = process.env.SLACK_BOT_TOKEN || ""
const signingSecret =  process.env.SLACK_SIGNING_SECRET || ""
const slackAppToken = process.env.SLACK_APP_TOKEN || ""
const channel_id    = process.env.SLACK_CHANNEL_ID || ""
const environment   = process.env.ENVIRONMENT || ""
const runport : any  = process.env.PORT || 3000
const acceptValue : any = `${randomUUID()}-approve`;
const rejectValue : any = `${randomUUID()}-reject`;

const app = new App({
  token: token,
  signingSecret: signingSecret,
  appToken: slackAppToken,
  socketMode: true,
  logLevel: LogLevel.DEBUG,
});

async function run(): Promise<void> {
  try {
    const web = new WebClient(token);

    const github_server_url = process.env.GITHUB_SERVER_URL || "";
    const github_repos = process.env.GITHUB_REPOSITORY || "";
    const run_id = process.env.GITHUB_RUN_ID || "";
    const actionsUrl = `${github_server_url}/${github_repos}/actions/runs/${run_id}`;
    const workflow   = process.env.GITHUB_WORKFLOW || "";
    const runnerOS   = process.env.RUNNER_OS || "";
    const actor      = process.env.GITHUB_ACTOR || "";

    (async () => {
      await web.chat.postMessage({
        channel: channel_id,
        text: "GitHub Actions Approval request",
        blocks: [
            {
              "type": "section",
              "text": {
                  "type": "mrkdwn",
                  "text": "GitHub Action *Approval Request*",
                }
            },
            {
              "type": "section",
              "fields": [
                {
                  "type": "mrkdwn",
                  "text": `*GitHub Actor:* ${actor}`
                },

                {
                  "type": "mrkdwn",
                  "text": `*ENV:* ${environment}`
                },
                {
                  "type": "mrkdwn",
                  "text": `*Repository:* ${github_repos}`
                },
                {
                  "type": "mrkdwn",
                  "text": `*Url:* ${actionsUrl}`
                }
              ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Approve"
                        },
                        "style": "primary",
                        "value": acceptValue,
                        "action_id": "slack-approval-approve"
                    },
                    {
                        "type": "button",
                        "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Reject"
                        },
                        "style": "danger",
                        "value": rejectValue,
                        "action_id": "slack-approval-reject"
                    }
                ]
            }
        ]
      });
    })();

    app.action('slack-approval-approve', async ({ack, client, body, logger, payload}) => {
      try {
        if((payload as any).value === acceptValue) {
          await ack();
          const response_blocks = (<BlockAction>body).message?.blocks
          response_blocks.pop()
          response_blocks.push({
            'type': 'section',
            'text': {
              'type': 'mrkdwn',
              'text': `Approved by <@${body.user.id}> `,
            },
          })

          await client.chat.update({
            channel: body.channel?.id || "",
            ts: (<BlockAction>body).message?.ts || "",
            blocks: response_blocks
          })

          process.exit(0);
        }
      } catch (error) {
        logger.error(error)
        process.exit(1)
      }
    });

    app.action('slack-approval-reject', async ({ack, client, body, logger, payload}) => {
      try {
        if((payload as any).value === rejectValue) {
          await ack();
          const response_blocks = (<BlockAction>body).message?.blocks
          response_blocks.pop()
          response_blocks.push({
            'type': 'section',
            'text': {
              'type': 'mrkdwn',
              'text': `Rejected by <@${body.user.id}>`,
            },
          })

          await client.chat.update({
            channel: body.channel?.id || "",
            ts: (<BlockAction>body).message?.ts || "",
            blocks: response_blocks
          });

          process.exit(1);
        }
      } catch (error) {
        logger.error(error)
        process.exit(1)
      }

    });

    (async () => {
        await app.start(runport);
        console.log('Waiting Approval reaction.....');
    })();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
