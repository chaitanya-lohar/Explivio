import { Database, Sun, Utensils, type LucideIcon } from "lucide-react";
import type { VideoDuration } from "@/types/video";

export interface VideoIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: LucideIcon;
  /** Text placed in the prompt field when the idea is chosen. */
  prompt: string;
  durationSeconds: VideoDuration;
}

export const videoIdeas: readonly VideoIdea[] = [
  {
    id: "apis",
    title: "How APIs work (restaurant analogy)",
    description: "See how a waiter carrying orders between you and the kitchen is just like an API.",
    category: "Technology",
    icon: Utensils,
    prompt: "Explain how APIs work to complete beginners using a restaurant analogy: the customer, the waiter and the kitchen.",
    durationSeconds: 60,
  },
  {
    id: "sky",
    title: "Why the sky is blue",
    description: "Find out why sunlight makes the sky look blue during the day.",
    category: "Physics",
    icon: Sun,
    prompt: "Explain why the sky looks blue during the day, for curious beginners with no science background.",
    durationSeconds: 60,
  },
  {
    id: "database-index",
    title: "How a database index speeds up a search",
    description: "Learn how an index helps a database find information without checking every row.",
    category: "Databases",
    icon: Database,
    prompt: "Explain how a database index speeds up a search, for beginners, using a library catalog analogy.",
    durationSeconds: 60,
  },
];
