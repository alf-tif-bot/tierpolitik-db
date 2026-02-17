import { z } from 'zod'

export const ebeneEnum = z.enum(['Bund', 'Kanton', 'Gemeinde'])
export const statusEnum = z.string().min(1)

export const personSchema = z.object({
  name: z.string().min(1),
  rolle: z.string(),
  partei: z.string().min(1),
})

export const resultSchema = z.object({
  datum: z.string().date(),
  status: statusEnum,
  bemerkung: z.string().min(1),
})

export const mediaSchema = z.object({
  datum: z.string().date(),
  titel: z.string().min(1),
  quelle: z.string().min(1),
  url: z.string().url(),
})

export const typEnum = z.string().min(1)

export const vorstossSchema = z.object({
  id: z.string().regex(/^vp-[a-z0-9-]+$/),
  titel: z.string().min(3),
  typ: typEnum,
  kurzbeschreibung: z.string().min(10),
  geschaeftsnummer: z.string().min(3),
  ebene: ebeneEnum,
  kanton: z.string().nullable(),
  regionGemeinde: z.string().nullable(),
  status: statusEnum,
  datumEingereicht: z.string().date(),
  datumAktualisiert: z.string().date(),
  themen: z.array(z.string().min(2)).min(1),
  schlagwoerter: z.array(z.string().min(2)).min(1),
  einreichende: z.array(personSchema).min(1),
  linkGeschaeft: z.string().url(),
  resultate: z.array(resultSchema),
  medien: z.array(mediaSchema),
  metadaten: z.object({
    sprache: z.enum(['de', 'fr', 'it', 'en']),
    haltung: z.enum(['pro-tierschutz', 'tierschutzkritisch', 'neutral/unklar']).optional(),
    initiativeLinks: z.object({
      campaignUrl: z.string().url().optional(),
      resultUrl: z.string().url().optional(),
    }).optional(),
    i18n: z.object({
      title: z.record(z.string(), z.string()).optional(),
      summary: z.record(z.string(), z.string()).optional(),
      type: z.record(z.string(), z.string()).optional(),
      themes: z.record(z.string(), z.array(z.string())).optional(),
    }).optional(),
    zuletztGeprueftVon: z.string().min(1),
  }),
})

export const vorstoesseSchema = z.array(vorstossSchema)

export type Vorstoss = z.infer<typeof vorstossSchema>
export type Ebene = z.infer<typeof ebeneEnum>
export type Status = z.infer<typeof statusEnum>

export function validateVorstoesse(input: unknown): Vorstoss[] {
  return vorstoesseSchema.parse(input)
}
