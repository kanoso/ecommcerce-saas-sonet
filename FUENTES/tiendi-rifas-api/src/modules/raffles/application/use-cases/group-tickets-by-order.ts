import { Ticket } from '../../domain';

export function groupTicketsByOrder(
  tickets: Ticket[],
): Map<string | null, Ticket[]> {
  const groups = new Map<string | null, Ticket[]>();
  for (const ticket of tickets) {
    groups.set(ticket.orderId, [...(groups.get(ticket.orderId) ?? []), ticket]);
  }
  return groups;
}
