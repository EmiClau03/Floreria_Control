import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const movements = sqliteTable('movements', {
id:text('id').primaryKey(), type:text('type').notNull(), amount:integer('amount').notNull(), date:text('date').notNull(), description:text('description').notNull(), category:text('category').notNull(), payment:text('payment').notNull(), createdAt:text('created_at').notNull()
});
