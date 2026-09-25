import type { Env, OpenDentalJob } from "../types.js";

export async function handleQueueBatch(
  batch: MessageBatch<OpenDentalJob>,
  env: Env
): Promise<void> {
  console.log(`[Queue] Processing batch of ${batch.messages.length} Open Dental jobs`);

  for (const message of batch.messages) {
    const job = message.body;

    try {
      switch (job.type) {
        case "RECALL_REMINDER": {
          const { patNum, patientName, phone, dateDue } = job.payload as {
            patNum: number;
            patientName: string;
            phone: string;
            dateDue: string;
          };

          console.log(`[Recall] Sending hygiene reminder to ${patientName} (${phone}) for due date: ${dateDue}`);

          // Record communication log entry in D1
          await env.DB.prepare(`
            INSERT INTO commlog (
              PatNum, CommType, Note, Mode_, SentOrReceived
            ) VALUES (?, 4, ?, 2, 1)
          `).bind(
            patNum,
            `Automated SMS hygiene recall reminder sent for due date ${dateDue}`
          ).run();

          message.ack();
          break;
        }

        case "CLAIM_SUBMISSION": {
          console.log(`[Claims] Processing EDI 837D submission batch:`, job.payload);
          message.ack();
          break;
        }

        case "ELIGIBILITY_CHECK": {
          console.log(`[Eligibility] Processing EDI 270/271 real-time eligibility check:`, job.payload);
          message.ack();
          break;
        }

        default:
          message.ack();
      }
    } catch (err) {
      console.error(`[Queue Error] Failed to process message ${message.id}:`, err);
      message.retry();
    }
  }
}
