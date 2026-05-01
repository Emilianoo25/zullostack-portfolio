import { defineCollection, z } from 'astro:content';

const casos = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    client: z.string(),
    location: z.string(),
    year: z.number(),
    category: z.string(),
    tags: z.array(z.string()),
    problem: z.string(),
    solution: z.string(),
    result: z.string(),
    featured: z.boolean().default(false),
    publishedAt: z.date(),
  }),
});

export const collections = { casos };
