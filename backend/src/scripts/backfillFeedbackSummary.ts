import 'dotenv/config';
import {
  initializeSchema,
  getAllUsers,
  getFeedback,
  upsertFeedbackSummary,
  deleteFeedbackSummary,
  isPostgresDatabase,
} from '../database';
import {
  summarizeFeedbackSignals,
  defaultNormalizeTitleKey,
  type OutfitFeedback,
  type FeedbackSignalSummary,
} from '../outfitFeedback';

async function backfillFeedbackSummaries(): Promise<void> {
  await initializeSchema().catch(() => undefined);
  const dbKind = isPostgresDatabase() ? 'PostgreSQL' : 'SQLite';
  console.log(`[FeedbackSummary] Running backfill on ${dbKind} database...`);

  const users = await getAllUsers();
  console.log(`[FeedbackSummary] Processing ${users.length} users`);

  let updatedCount = 0;
  let clearedCount = 0;

  for (const user of users) {
    const userId: string = user.id;
    const feedbackEntries = (await getFeedback(userId)) as OutfitFeedback[];

    if (!feedbackEntries || feedbackEntries.length === 0) {
      await deleteFeedbackSummary(userId);
      clearedCount += 1;
      continue;
    }

    const summary: FeedbackSignalSummary | null = summarizeFeedbackSignals(
      feedbackEntries,
      defaultNormalizeTitleKey
    );

    if (summary) {
      await upsertFeedbackSummary(userId, summary);
      updatedCount += 1;
    } else {
      await deleteFeedbackSummary(userId);
      clearedCount += 1;
    }
  }

  console.log(
    `[FeedbackSummary] Completed. Updated ${updatedCount} summaries. Cleared ${clearedCount} empty summaries.`
  );
}

backfillFeedbackSummaries().catch(error => {
  console.error('[FeedbackSummary] Failed:', error);
  process.exit(1);
});
