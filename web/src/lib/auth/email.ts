/*
 * F10's email module, kept as a thin compatibility layer (F13). Email now goes through the durable queue and providers
 * in lib/email/: authentication code queues a job and never calls a provider itself.
 */
import { deliveryMode } from "../email/provider.ts";

export type DeliveryMode = "outbox" | "resend";
export { appUrl } from "../email/config.ts";
export { outboxDir } from "../email/providers/outbox.ts";

/** What the screens may say about delivery (see lib/email/provider.ts). */
export const emailMode = (): DeliveryMode => deliveryMode();
