import { z } from 'zod'

export const sourceTypeSchema = z.enum(['rss', 'html', 'api', 'user'])
export const itemStatusSchema = z.enum(['new', 'queued', 'approved', 'rejected', 'published'])

export const sourceSchema = z.object({
  id: z.string().min(2),
  label: z.string().min(2),
  type: sourceTypeSchema,
  adapter: z.string().min(2).optional(),
  url: z.url(),
  enabled: z.boolean().default(true),
  fallbackPath: z.string().optional(),
  options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export const rawItemSchema = z.object({
  sourceId: z.string().min(2),
  sourceUrl: z.url(),
  externalId: z.string().min(2),
  title: z.string().min(5),
  summary: z.string().default(''),
  body: z.string().default(''),
  publishedAt: z.string().datetime().nullable().default(null),
  fetchedAt: z.string().datetime(),
  language: z.enum(['de', 'fr', 'it', 'en']).default('de'),
})

export const scoredItemSchema = rawItemSchema.extend({
  score: z.number().min(0).max(1),
  matchedKeywords: z.array(z.string()).default([]),
  status: itemStatusSchema.default('new'),
  reviewReason: z.string().default(''),
})

export const reviewDecisionSchema = z.object({
  id: z.string().min(2),
  status: z.enum(['approved', 'rejected']),
  reviewer: z.string().min(2),
  decidedAt: z.string().datetime(),
  note: z.string().default(''),
})

export const publicationRecordSchema = z.object({
  id: z.string().min(2),
  publishedAt: z.string().datetime(),
  websiteSlug: z.string().min(2),
  websiteUrl: z.url(),
})

export const dbSchema = z.object({
  sources: z.array(sourceSchema).default([]),
  items: z.array(scoredItemSchema).default([]),
  publications: z.array(publicationRecordSchema).default([]),
  updatedAt: z.string().datetime(),
})

export const validateDb = (payload) => dbSchema.parse(payload)
