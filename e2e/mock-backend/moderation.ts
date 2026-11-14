import { addDays, mockUuid, pick, seeded, shortOf, todayParis } from './random.ts';
import { capabilitiesFor, fail, registerRpc, requireReason } from './rpc.ts';
import { appendAudit, state } from './state.ts';
import { mockUsers } from './users.ts';

/** Signalements SYNTHÉTIQUES de la phase 8c (éléments partagés uniquement). */

interface MockReport {
  id: string;
  created_at: string;
  status: 'open' | 'actioned' | 'dismissed';
  reason: string;
  target_short: string;
  element_kind: string;
  excerpt: string | null;
  reports_count: number;
  element: { kind: string; text: string | null; media_ref: string | null; visibility: string; published_at: string };
  history: { at: string; decision: string; reason: string | null; admin_short: string; note: string | null }[];
}

const TEXTS = [
  'Texte de présentation synthétique n° {n} signalé pour vérification.',
  'Statut de test n° {n} contenant un lien externe non vérifié.',
  'Pseudo de démonstration n° {n} jugé trompeur par un membre.',
];

function reports(): MockReport[] {
  if (!state.ext.reports) {
    const rand = seeded(88);
    const users = mockUsers();
    const today = todayParis();
    state.ext.reports = Array.from({ length: 30 }, (_, i): MockReport => {
      const kind = pick(rand, ['bio', 'status', 'handle', 'avatar', 'link']);
      const media = kind === 'avatar';
      const text = media ? null : pick(rand, TEXTS).replace('{n}', String(i + 1));
      const created = `${addDays(today, -Math.floor(i / 3))}T${String(9 + (i % 9)).padStart(2, '0')}:05:00Z`;
      const status = i < 18 ? 'open' : i < 25 ? 'actioned' : 'dismissed';
      return {
        id: mockUuid('report', i + 1),
        created_at: created,
        status,
        reason: pick(rand, ['spam', 'harassment', 'impersonation', 'personal_data', 'other']),
        target_short: (users[(i * 31) % users.length] as { short_id: string }).short_id,
        element_kind: kind,
        excerpt: media ? `média ${kind} · réf. m_${(i + 1).toString(16).padStart(6, '0')}` : text,
        reports_count: 1 + Math.floor(rand() * 4),
        element: { kind, text, media_ref: media ? `m_${(i + 1).toString(16).padStart(6, '0')}` : null, visibility: 'members', published_at: `${addDays(today, -20)}T10:00:00Z` },
        history: status === 'open' ? [] : [{ at: created, decision: status === 'actioned' ? 'hide' : 'dismiss', reason: 'technical', admin_short: 'a11ce000', note: null }],
      };
    });
  }
  return state.ext.reports as MockReport[];
}

function listItem(r: MockReport) {
  const { element: _element, history: _history, ...item } = r;
  return item;
}

registerRpc('admin_list_reports', {
  capability: 'moderation.read',
  handler: (params) => {
    const statuses = Array.isArray(params.p_status) && params.p_status.length ? (params.p_status as string[]) : ['open'];
    for (const s of statuses) if (!['open', 'actioned', 'dismissed'].includes(s)) throw fail.param('status');
    const limit = typeof params.p_limit === 'number' ? params.p_limit : 50;
    const rows = reports()
      .filter((r) => statuses.includes(r.status))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1));
    const cursor = params.p_cursor as { created_at?: string; id?: string } | null | undefined;
    const after = cursor?.created_at && cursor.id ? rows.filter((r) => r.created_at < (cursor.created_at as string) || (r.created_at === cursor.created_at && r.id < (cursor.id as string))) : rows;
    const page = after.slice(0, limit);
    const last = page[page.length - 1];
    return { items: page.map(listItem), next_cursor: after.length > limit && last ? { created_at: last.created_at, id: last.id } : null };
  },
});

registerRpc('admin_get_report', {
  capability: 'moderation.read',
  handler: (params, ctx) => {
    const reason = requireReason(params);
    const report = reports().find((r) => r.id === params.p_report_id);
    if (!report) throw fail.notFound();
    appendAudit({ admin_id: ctx.user.id, admin_short: shortOf(ctx.user.id), action: 'moderation.view', target_user_id: null, target_short: report.target_short, reason, metadata: { report: report.id.slice(0, 8) } });
    return { report: listItem(report), element: report.element, history: report.history };
  },
});

registerRpc('admin_report_media', {
  capability: 'moderation.read',
  handler: (params, ctx) => {
    const reason = requireReason(params);
    const report = reports().find((item) => item.id === params.p_report_id);
    if (!report?.element.media_ref || report.element.visibility === 'removed') throw fail.notFound();
    appendAudit({ admin_id: ctx.user.id, admin_short: shortOf(ctx.user.id), action: 'moderation.media', target_user_id: null, target_short: report.target_short, reason, metadata: { report: report.id.slice(0, 8) } });
    return { mime: 'image/png' };
  },
});

registerRpc('admin_moderate', {
  capability: 'moderation.read',
  handler: (params, ctx) => {
    if (!capabilitiesFor(ctx.user).includes('moderation.decide')) throw fail.forbidden();
    const reason = requireReason(params);
    const decision = String(params.p_decision ?? '');
    if (!['hide', 'remove', 'restore', 'dismiss'].includes(decision)) throw fail.param('decision');
    const report = reports().find((r) => r.id === params.p_report_id);
    if (!report) throw fail.notFound();
    report.status = decision === 'dismiss' ? 'dismissed' : 'actioned';
    const note = typeof params.p_note === 'string' && params.p_note ? params.p_note : null;
    report.history.unshift({ at: new Date().toISOString(), decision, reason, admin_short: shortOf(ctx.user.id), note });
    if (decision === 'remove') report.element = { ...report.element, text: null, media_ref: null, visibility: 'removed' };
    appendAudit({
      admin_id: ctx.user.id,
      admin_short: shortOf(ctx.user.id),
      action: 'moderation.decide',
      target_user_id: null,
      target_short: report.target_short,
      reason,
      metadata: { decision, report: report.id.slice(0, 8) },
    });
    return { report_id: report.id, decision, status: report.status };
  },
});
