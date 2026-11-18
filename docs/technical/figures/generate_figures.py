#!/usr/bin/env python3
"""Generate the numbered figures for the WURK UP technical manual.

Every figure is drawn from the same specification used in the Markdown manual, so
the PDF and the editable source cannot drift. Run from the repository root:

    python3 docs/technical/figures/generate_figures.py

Output: docs/technical/figures/fig-01 … fig-12 (.png, 200 dpi).
"""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle

OUT = Path(__file__).resolve().parent

INK = "#0f1c17"
FOREST = "#12503a"
FOREST_LIGHT = "#e7f0ea"
BRASS = "#a97c2f"
BRASS_LIGHT = "#f6efdf"
SAND = "#f4efe6"
GREY = "#5b6b63"
ROSE = "#9d2f3c"
ROSE_LIGHT = "#fbe9ec"
BLUE = "#1f4e79"
BLUE_LIGHT = "#e8eef6"

plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "figure.dpi": 200,
        "savefig.dpi": 200,
    }
)


def canvas(width=13.0, height=7.4):
    fig, ax = plt.subplots(figsize=(width, height))
    ax.set_xlim(-2, 102)
    ax.set_ylim(-1.5, 101.5)
    ax.axis("off")
    return fig, ax


def box(ax, x, y, w, h, title, lines=(), fill=FOREST_LIGHT, edge=FOREST, title_color=INK, fontsize=9.5):
    ax.add_patch(
        FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.35,rounding_size=1.2",
            linewidth=1.1,
            edgecolor=edge,
            facecolor=fill,
            zorder=2,
        )
    )
    ax.text(x + w / 2, y + h - 2.1, title, ha="center", va="top", fontsize=fontsize, fontweight="bold", color=title_color, zorder=3)
    for index, line in enumerate(lines):
        ax.text(x + w / 2, y + h - 5.2 - index * 3.0, line, ha="center", va="top", fontsize=fontsize - 1.6, color=GREY, zorder=3)


def band(ax, x, y, w, h, label, fill=SAND):
    ax.add_patch(Rectangle((x, y), w, h, facecolor=fill, edgecolor="#d9d2c4", linewidth=0.9, zorder=1))
    ax.text(
        x + 1.2, y + h - 1.4, label,
        ha="left", va="top", fontsize=8.0, fontweight="bold", color=BRASS,
        zorder=6, bbox=dict(facecolor=fill, edgecolor="none", pad=1.4),
    )


def arrow(ax, start, end, color=FOREST, style="-|>", lw=1.3, curve=0.0, label=None, label_offset=(0, 1.4)):
    ax.add_patch(
        FancyArrowPatch(
            start,
            end,
            arrowstyle=style,
            mutation_scale=13,
            linewidth=lw,
            color=color,
            connectionstyle=f"arc3,rad={curve}",
            zorder=4,
        )
    )
    if label:
        ax.text(
            (start[0] + end[0]) / 2 + label_offset[0],
            (start[1] + end[1]) / 2 + label_offset[1],
            label,
            ha="center",
            va="bottom",
            fontsize=7.2,
            color=color,
            bbox=dict(facecolor="white", edgecolor="none", pad=0.8),
            zorder=5,
        )


CAPTIONS = {}


def title(ax, text, subtitle=None):
    """Record the figure caption.

    The caption is typeset by the manual (docs/technical/build_manual_pdf.py), not
    drawn inside the artwork, so a figure never shows its number twice on the page.
    The values recorded here are also printed at generation time for reference.
    """
    CAPTIONS[text.split(" · ")[0]] = (text, subtitle)


def trim(path):
    """Crop uniform white margins so the artwork starts where the diagram starts."""
    from PIL import Image, ImageChops

    im = Image.open(path).convert("RGB")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bbox = ImageChops.difference(im, bg).getbbox()
    if bbox:
        pad = 14
        box = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0),
               min(bbox[2] + pad, im.width), min(bbox[3] + pad, im.height))
        im.crop(box).save(path)


def save(fig, name):
    fig.savefig(OUT / name, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    trim(OUT / name)
    print("wrote", name)


# ---------------------------------------------------------------------------
# 1. Overall system architecture
# ---------------------------------------------------------------------------
def figure_01():
    fig, ax = canvas()
    title(ax, "Figure 1 · Overall system architecture", "Browser runtime, static hosting and managed backend")

    band(ax, 2, 62, 96, 27, "CLIENT (browser · React 19 + TypeScript, built by Vite)")
    box(ax, 4, 66, 20, 17, "Public site", ["Home · About · Privacy", "Help · How it works", "Judge demo"])
    box(ax, 27, 66, 20, 17, "Auth screens", ["Register · Sign in", "Password recovery", "Pass verification"])
    box(ax, 50, 66, 22, 17, "Role dashboards", ["Worker workspace", "Contractor workspace"])
    box(ax, 75, 66, 20, 17, "Local-first store", ["localStorage + IndexedDB", "Offline demo data"], fill=BRASS_LIGHT, edge=BRASS)

    band(ax, 2, 30, 96, 27, "APPLICATION SERVICES (src/services — no server of our own)")
    box(ax, 4, 34, 21, 17, "supabase.ts", ["client factory", "env guard, fail-closed"])
    box(ax, 28, 34, 21, 17, "dashboardData.ts", ["RLS-aware queries", "dispute / approval writes"])
    box(ax, 52, 34, 21, 17, "analytics + engines", ["wage maths (paise)", "anomaly rules"])
    box(ax, 76, 34, 19, 17, "i18n / copy", ["en ⇄ hi dictionaries", "audit script"])

    band(ax, 2, 4, 62, 22, "MANAGED BACKEND (Supabase · ap-south-1)")
    box(ax, 4, 7, 18, 15, "Auth (GoTrue)", ["email + password", "JWT 3600 s"])
    box(ax, 24, 7, 18, 15, "PostgREST", ["RLS + column grants", "role: authenticated"])
    box(ax, 44, 7, 18, 15, "PostgreSQL 17", ["11 tables · 9 functions", "12 RLS policies"])

    band(ax, 66, 4, 32, 22, "EDGE + DELIVERY", fill=ROSE_LIGHT)
    box(ax, 68, 7, 13, 15, "Cloudflare", ["Workers static", "wurkup…workers.dev"], fill="white", edge=ROSE)
    box(ax, 83, 7, 13, 15, "Brevo SMTP", ["smtp-relay.brevo.com", "auth e-mails"], fill="white", edge=ROSE)

    arrow(ax, (61, 66), (61, 51))
    arrow(ax, (48, 66), (48, 51))
    arrow(ax, (50, 30), (50, 26))
    note = dict(fontsize=7.0, color=GREY, bbox=dict(facecolor="white", edgecolor="none", pad=1.0), zorder=5)
    ax.text(62.6, 58.4, "snapshot fetch", ha="left", **note)
    ax.text(49.4, 58.4, "typed panels", ha="left", **note)
    ax.text(51.6, 27.4, "HTTPS 443 · PostgREST + RLS", ha="left", **note)
    ax.text(80, 26.2, "e-mail is sent by Supabase Auth over SMTP 587", fontsize=7.0, color=ROSE, ha="center")
    save(fig, "fig-01-system-architecture.png")


# ---------------------------------------------------------------------------
# 2. Frontend component and routing structure
# ---------------------------------------------------------------------------
def figure_02():
    fig, ax = canvas()
    title(ax, "Figure 2 · Frontend component and routing structure", "Hash router → route components → shared shells")

    box(ax, 2, 78, 96, 15, "App.tsx — single React root", ["holds route state, language state, auth session, data-store hydration"], fill=BRASS_LIGHT, edge=BRASS)
    box(ax, 2, 60, 30, 14, "router.ts (hash routes)", ["#/home  #/how-it-works  #/about", "#/privacy  #/help  #/verify", "#/worker  #/contractor  #/judge-demo"])
    box(ax, 35, 60, 30, 14, "services/auth.ts", ["signUp · signIn · signOut", "resetPasswordForEmail", "onAuthStateChange"])
    box(ax, 68, 60, 30, 14, "services/i18n.ts", ["translations.en / .hi", "t(key, lang) · bi()", "localStorage persistence"])

    box(ax, 2, 40, 22, 16, "Public shell", ["Header · PublicHeader", "Footer · PageHeader", "LanguageNotice"], fill="white")
    box(ax, 26, 40, 22, 16, "Public pages", ["Home · HowItWorks", "About · Privacy", "HelpContact · NotFound"], fill="white")
    box(ax, 50, 40, 22, 16, "Auth pages", ["AuthLayout", "SignIn · CreateAccount", "PasswordRecovery"], fill="white")
    box(ax, 74, 40, 24, 16, "Verification", ["VerifyPass", "QRCodeDisplay", "ContactVerification"], fill="white")

    box(ax, 2, 18, 30, 17, "Worker workspace", ["DashboardShell + rail", "Overview · Attendance", "Wages · Approvals", "Disputes · Profile"], fill=FOREST_LIGHT)
    box(ax, 35, 18, 30, 17, "Contractor workspace", ["DashboardShell + rail", "Crew · Sites · Attendance", "Wages · Approvals", "Disputes (read-only)"], fill=FOREST_LIGHT)
    box(ax, 68, 18, 30, 17, "Judge demo", ["Isolated dataset", "Audit bench · anomaly rules", "Import / export / reset"], fill=FOREST_LIGHT)

    box(ax, 2, 3, 96, 11, "Shared UI kit · dashboardCopy.ts (typed en/hi dictionary) · ui.tsx primitives", ["Panels, notices, tables, forms and dialogs take language + copy from the shared dictionaries, never from inline literals"], fill=SAND, edge=BRASS)

    arrow(ax, (17, 78), (17, 74))
    arrow(ax, (50, 60), (50, 56))
    arrow(ax, (83, 60), (83, 56))
    arrow(ax, (37, 40), (37, 35))
    arrow(ax, (24, 40), (20, 35))
    arrow(ax, (86, 40), (86, 35))
    save(fig, "fig-02-frontend-structure.png")


# ---------------------------------------------------------------------------
# 3. Registration and authentication flow
# ---------------------------------------------------------------------------
def figure_03():
    fig, ax = canvas(width=13.0, height=7.6)
    title(ax, "Figure 3 · Registration and authentication flow", "Supabase GoTrue with mandatory e-mail confirmation")

    steps = [
        (1, "1. Create account", ["form: name, phone, e-mail,", "password, role, consent"]),
        (21, "2. auth.signUp()", ["emailRedirectTo = origin", "mailer_autoconfirm = false"]),
        (41, "3. Confirmation e-mail", ["Brevo relay → inbox", "one-time token link"]),
        (61, "4. Link returns to app", ["/verify pass-through", "session established"]),
        (81, "5. Profile + worker row", ["provision_shram_profile", "role from sign-up data"]),
    ]
    for x, heading, lines in steps:
        box(ax, x, 67, 18, 16, heading, lines, fontsize=8.8)

    for index in range(len(steps) - 1):
        arrow(ax, (steps[index][0] + 18, 75), (steps[index + 1][0], 75))

    band(ax, 3, 30, 95, 27, "GUARDS APPLIED ON EVERY REQUEST")
    box(ax, 5, 33, 21, 19, "JWT (1 h)", ["role: authenticated", "sub = auth.uid()"], fill="white")
    box(ax, 29, 33, 21, 19, "RLS policy", ["owner OR assigned", "contractor predicates"], fill="white")
    box(ax, 53, 33, 21, 19, "Column grants", ["directory columns only", "no user_id / PII"], fill="white")
    box(ax, 77, 33, 19, 19, "Failure mode", ["403 / 42501 surfaced", "no silent fallback"], fill=ROSE_LIGHT, edge=ROSE)

    band(ax, 3, 6, 95, 20, "RECOVERY PATH")
    box(ax, 5, 7.5, 24, 13, "resetPasswordForEmail()", ["redirectTo = app origin", "rate limit 30 / hour"], fill="white")
    box(ax, 33, 7.5, 24, 13, "Recovery e-mail", ["Brevo templates", "reset link"], fill="white")
    box(ax, 61, 7.5, 32, 13, "PasswordRecovery screen", ["handles expired / used links", "confirmation → sign in"], fill="white")
    arrow(ax, (29, 14), (33, 14))
    arrow(ax, (57, 14), (61, 14))
    arrow(ax, (17, 67), (17, 57))
    save(fig, "fig-03-auth-flow.png")


# ---------------------------------------------------------------------------
# 4. Password recovery flow
# ---------------------------------------------------------------------------
def figure_04():
    fig, ax = canvas()
    title(ax, "Figure 4 · Password recovery flow", "Request → e-mail → recovery session → new password")

    steps = [
        (3, 70, "User requests reset", ["#/forgot-password", "e-mail only, no account hint"]),
        (27, 70, "GoTrue sends e-mail", ["subject ‘Reset your password’", "token expires in 1 h"]),
        (51, 70, "User opens link", ["app origin + recovery hash", "session type = recovery"]),
        (75, 70, "PasswordRecovery", ["expired / used / valid", "states are explicit"]),
    ]
    for x, y, heading, lines in steps:
        box(ax, x, y, 21, 20, heading, lines)
    for index in range(len(steps) - 1):
        arrow(ax, (steps[index][0] + 21, 80), (steps[index + 1][0], 80))

    box(ax, 3, 44, 30, 18, "Success", ["‘Password updated’", "→ continue to sign in"], fill=FOREST_LIGHT)
    box(ax, 37, 44, 30, 18, "Expired link", ["explicit guidance", "request a new e-mail"], fill=BRASS_LIGHT, edge=BRASS)
    box(ax, 71, 44, 25, 18, "Rejected request", ["rate-limited or unknown", "no account enumeration"], fill=ROSE_LIGHT, edge=ROSE)
    arrow(ax, (85, 70), (85, 62))
    arrow(ax, (61, 70), (50, 62))
    arrow(ax, (13, 70), (18, 62))

    band(ax, 3, 8, 93, 29, "KEPT IN CODE (PR #11 · auth branch)")
    box(ax, 5, 11, 27, 20, "auth.ts", ["resetPasswordForEmail(email,", "{ redirectTo: origin })", "error mapping"], fontsize=8.8)
    box(ax, 35, 11, 27, 20, "PasswordRecovery.tsx", ["recoveryError +", "recoveryComplete props", "bilingual copy"], fill="white", fontsize=8.8)
    box(ax, 65, 11, 29, 20, "Regression coverage", ["smoke-render: expired + success", "rate-limit and callback guards"], fill="white", fontsize=8.8)
    save(fig, "fig-04-password-recovery.png")


# ---------------------------------------------------------------------------
# 5. Database ER diagram
# ---------------------------------------------------------------------------
def figure_05():
    fig, ax = canvas(width=14.0, height=8.8)
    title(ax, "Figure 5 · Database entity-relationship diagram",
          "9 business tables in the ER view · audit and QR tables are service-role only")

    def entity(x, y, w, name, cols, fill=FOREST_LIGHT, edge=FOREST):
        """Rounded entity with a header band sized from the column count."""
        header = 5.0
        h = header + 3.1 * len(cols) + 2.4
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=1.0",
                                    linewidth=1.1, edgecolor=edge, facecolor="white", zorder=2))
        ax.add_patch(FancyBboxPatch((x, y + h - header), w, header,
                                    boxstyle="round,pad=0.25,rounding_size=1.0",
                                    linewidth=1.1, edgecolor=edge, facecolor=fill, zorder=3))
        ax.text(x + 1.2, y + h - header / 2, name, fontsize=8.4, fontweight="bold", color=INK, va="center", zorder=4)
        for index, column in enumerate(cols):
            ax.text(x + 1.4, y + h - header - 2.0 - index * 3.1, column, fontsize=6.9, color=GREY, va="center", zorder=4)
        return {"x": x, "y": y, "w": w, "h": h,
                "right": (x + w, y + h / 2), "left": (x, y + h / 2),
                "top": (x + w / 2, y + h), "bottom": (x + w / 2, y)}

    c1, c2, c3 = 2, 36, 70
    w1, w2, w3 = 27, 27, 28

    profiles = entity(c1, 71, w1, "profiles", ["id uuid PK (auth.users)", "role varchar ('worker' / 'contractor')", "full_name, phone", "created_at, updated_at"], fill=BRASS_LIGHT, edge=BRASS)
    workers = entity(c1, 40, w1, "workers", ["id text PK (WKR-…)", "user_id uuid → auth.users (not granted)", "name, hindi_name, trade",
                                            "skill_level (check constraint)", "daily_base_wage_paise bigint", "active_site_id → sites",
                                            "contact_sharing_consent boolean"])
    private = entity(c1, 6, w1, "worker_private_data", ["worker_id PK → workers", "phone, eshram_uan, bocw_registration_no", "aadhaar_last4, bank_account_last4", "ifsc_code, upi_id, blood_group · RPC only"], fill=ROSE_LIGHT, edge=ROSE)

    sites = entity(c2, 66, w2, "sites", ["id text PK", "name, hindi_name, city", "contractor_name, contractor_phone", "project_type, latitude, longitude", "active_workers, safety_rating"])
    assignments = entity(c2, 42, w2, "contractor_worker_assignments", ["id uuid PK", "worker_id → workers", "contractor_id → auth.users", "created_at"])
    approvals = entity(c2, 16, w2, "approval_requests", ["id text PK", "worker_id, contractor_id", "action_type, amount_paise, record_id", "status (check), responded_at"])

    attendance = entity(c3, 64, w3, "attendance_records", ["id text PK", "worker_id, site_id", "date, time_in, time_out, shift_type", "calculated_wage_paise bigint", "verification_hash, previous_hash"])
    ledger = entity(c3, 36, w3, "wage_ledger_entries", ["id text PK", "worker_id, site_id", "type, amount_paise, date", "acknowledgment_status", "utr_or_receipt_no"])
    disputes = entity(c3, 6, w3, "disputes", ["id text PK", "worker_id, dispute_type (check)", "claimed_amount_paise, filing_date", "dlo_filing_ref UNIQUE (WU-DSP-…)", "status (check)", "contractor_response, response_date"])

    arrow(ax, profiles["bottom"], workers["top"], label="1:1 owner", label_offset=(12, 0.4))
    arrow(ax, workers["bottom"], private["top"], label="1:1 private", label_offset=(13, 0.4))
    arrow(ax, sites["bottom"], assignments["top"], label="site of duty", label_offset=(13, 0.4))
    arrow(ax, workers["right"], (assignments["x"], assignments["y"] + 9), label="1:N", label_offset=(0, 0.9))
    arrow(ax, assignments["right"], (ledger["x"], ledger["y"] + 12), label="scopes reads", label_offset=(0, 0.9))
    arrow(ax, attendance["bottom"], (ledger["x"] + 6, ledger["y"] + ledger["h"]), label="same worker + site", label_offset=(10, 0.9))
    arrow(ax, approvals["right"], (disputes["x"], disputes["y"] + 4), label="worker participant", label_offset=(-2, -2.4))

    ax.text(2, 2.2, "Foreign keys are real constraints in PostgreSQL. String keys (WKR-, DSP-, ATD-) keep QR references and audit hashes readable;\nuuid keys appear only where the value is an authentication identity (profiles.id, workers.user_id, contractor_id).",
            fontsize=6.9, color=GREY, va="bottom")
    save(fig, "fig-05-er-diagram.png")


# ---------------------------------------------------------------------------
# 6. RLS and role-permission diagram
# ---------------------------------------------------------------------------
def figure_06():
    fig, ax = canvas()
    title(ax, "Figure 6 · RLS and role-permission model", "Three actors, one policy set, no privileged bypass in the browser")

    band(ax, 2, 74, 96, 16, "ACTORS")
    box(ax, 4, 75.5, 28, 10, "anon", ["no grants on business tables", "public pages only"], fill=SAND, edge=GREY)
    box(ax, 36, 75.5, 28, 10, "authenticated · worker", ["own worker row + own records"], fill=FOREST_LIGHT)
    box(ax, 68, 75.5, 28, 10, "authenticated · contractor", ["assigned workers only"], fill=BRASS_LIGHT, edge=BRASS)

    band(ax, 2, 44, 96, 26, "PREDICATES (SECURITY DEFINER · boolean only)")
    box(ax, 4, 47, 28, 19, "is_current_worker(id)", ["owns the worker row", "reads workers.user_id with owner rights"], fill="white")
    box(ax, 36, 47, 28, 19, "is_assigned_contractor(id)", ["assignment row exists", "for auth.uid()"], fill="white")
    box(ax, 68, 47, 28, 19, "can_read_worker(id)", ["OR of the two above", "single policy entry point"], fill="white")

    band(ax, 2, 18, 96, 22, "POLICIES (row level security · 12 policies)")
    box(ax, 4, 19.5, 22, 14, "workers", ["self OR assigned"], fill=FOREST_LIGHT)
    box(ax, 28, 19.5, 22, 14, "attendance / ledger", ["can_read_worker"], fill=FOREST_LIGHT)
    box(ax, 52, 19.5, 22, 14, "disputes", ["read: can_read_worker", "insert: owner only"], fill=FOREST_LIGHT)
    box(ax, 76, 19.5, 20, 14, "approvals", ["read: participant", "update: owner + pending"], fill=FOREST_LIGHT)

    box(ax, 2, 2, 96, 12, "COLUMN GRANTS — authenticated", ["workers: id, name, hindi_name, trade, skill_level, daily_base_wage_paise, active_site_id, created_at, contact_sharing_consent  ·  user_id excluded",
                                                                      "private data (phone, Aadhaar, e-Shram, bank, UPI) lives in worker_private_data and is reachable only through SECURITY DEFINER RPCs"], fill=SAND, edge=BRASS)
    arrow(ax, (50, 74), (50, 70))
    arrow(ax, (50, 44), (50, 40))
    arrow(ax, (50, 18), (50, 14), style="-|>")
    save(fig, "fig-06-rls-roles.png")


# ---------------------------------------------------------------------------
# 7. Worker onboarding
# ---------------------------------------------------------------------------
def figure_07():
    fig, ax = canvas()
    title(ax, "Figure 7 · Worker onboarding flow", "From sign-up to a dashboard-ready worker row")

    box(ax, 3, 74, 22, 16, "1. Account created", ["profiles row via trigger", "role = worker"])
    box(ax, 29, 74, 22, 16, "2. Auth state resolved", ["useAuth session", "profile fetched (RLS: self)"])
    box(ax, 55, 74, 22, 16, "3. Worker row needed?", ["SELECT workers", "0 rows → onboarding"])
    box(ax, 81, 74, 16, 16, "4. Wizard", ["trade + skill"])

    box(ax, 55, 48, 22, 18, "complete_my_worker_onboarding()", ["SECURITY DEFINER RPC", "creates WKR-… row for auth.uid()"], fill=BRASS_LIGHT, edge=BRASS)
    box(ax, 81, 48, 16, 18, "Row created", ["id = WKR-<uuid>", "contact consent default false"])

    box(ax, 3, 22, 30, 20, "5. Dashboard loads", ["fetchWorkerSnapshot()", "worker + attendance + ledger", "+ disputes + approvals"], fill=FOREST_LIGHT)
    box(ax, 37, 22, 30, 20, "6. Private details on demand", ["get_worker_private_data()", "phone · e-Shram · BOCW · bank", "never in a table SELECT"], fill=FOREST_LIGHT)
    box(ax, 71, 22, 26, 20, "7. Consent control", ["set_my_worker_contact_sharing()", "contractor reveal requires consent"], fill=FOREST_LIGHT)

    arrow(ax, (25, 82), (29, 82))
    arrow(ax, (51, 82), (55, 82))
    arrow(ax, (77, 82), (81, 82))
    arrow(ax, (89, 74), (89, 66))
    arrow(ax, (81, 57), (77, 57))
    arrow(ax, (55, 57), (33, 42))
    arrow(ax, (33, 32), (37, 32))
    arrow(ax, (67, 32), (71, 32))
    save(fig, "fig-07-worker-onboarding.png")


# ---------------------------------------------------------------------------
# 8. Worker dashboard data flow
# ---------------------------------------------------------------------------
def figure_08():
    fig, ax = canvas()
    title(ax, "Figure 8 · Worker dashboard data flow", "One snapshot, five authorised reads, no client-side filtering of foreign rows")

    box(ax, 2, 74, 26, 18, "useDashboardResource", ["loading · ready · error", "stale-response guard", "refetch on reconnect"], fill=BRASS_LIGHT, edge=BRASS)
    box(ax, 33, 74, 30, 18, "fetchWorkerSnapshot()", ["workers → exactly 1 row", ">1 row = hard error (safety)"])
    box(ax, 68, 74, 30, 18, "Snapshot object", ["worker · attendance[]", "ledger[] · disputes[]", "approvals[] · totals"])

    rows = [
        ("workers", "RLS: worker_self_read (own row)"),
        ("attendance_records", "RLS: can_read_worker()"),
        ("wage_ledger_entries", "RLS: can_read_worker()"),
        ("disputes", "RLS: can_read_worker()"),
        ("approval_requests", "RLS: contractor OR owner"),
    ]
    y = 58
    for table, policy in rows:
        box(ax, 33, y, 30, 9.6, table, [policy], fill="white", fontsize=8.2)
        y -= 11.0

    box(ax, 2, 30, 26, 16, "Panels", ["Overview · Attendance", "Wages · Approvals", "Disputes · Profile"], fill=FOREST_LIGHT)
    box(ax, 2, 8, 26, 14, "Writes (only two)", ["INSERT disputes (own row)", "UPDATE approvals (status)", "→ only after the worker acts"], fill=FOREST_LIGHT)

    arrow(ax, (28, 83), (33, 83))
    arrow(ax, (63, 83), (68, 83))
    arrow(ax, (48, 74), (48, 67.6))
    arrow(ax, (33, 40), (28, 40))
    arrow(ax, (15, 30), (15, 22), label="user action", label_offset=(6.5, 0))
    save(fig, "fig-08-worker-data-flow.png")


# ---------------------------------------------------------------------------
# 9. Contractor dashboard data flow
# ---------------------------------------------------------------------------
def figure_09():
    fig, ax = canvas()
    title(ax, "Figure 9 · Contractor dashboard data flow", "Assignment-scoped reads, consent-gated contact reveal, one permitted write")

    box(ax, 2, 72, 26, 18, "fetchContractorSnapshot()", ["7 parallel reads", "limit 200–400 rows"], fill=BRASS_LIGHT, edge=BRASS)
    box(ax, 32, 72, 30, 18, "Assignment scope", ["contractor_worker_assignments", "RLS: contractor_id = auth.uid()"])
    box(ax, 66, 72, 32, 18, "Snapshot object", ["crew · sites · attendance", "ledger · disputes · approvals"])

    box(ax, 32, 46, 30, 20, "Reads that are assignment-scoped", ["workers (assigned only)", "attendance_records", "wage_ledger_entries", "disputes (read-only)"], fill="white")
    box(ax, 66, 46, 32, 20, "Deliberately not available", ["no attendance writing", "no wage-rate change", "no payment recording", "labelled ‘Not connected’"], fill=ROSE_LIGHT, edge=ROSE)

    box(ax, 2, 20, 27, 20, "Contact reveal", ["get_assigned_worker_contact()", "requires assignment + consent", "phone never in a table SELECT"], fill=FOREST_LIGHT)
    box(ax, 33, 20, 27, 20, "Approval request", ["INSERT approval_requests", "status must be ‘pending’", "assigned contractor only"], fill=FOREST_LIGHT)
    box(ax, 64, 20, 34, 20, "Wage liability view", ["computed from ledger in paise", "informational only — no payout", "no bank data in the browser"], fill=FOREST_LIGHT)

    arrow(ax, (28, 81), (32, 81))
    arrow(ax, (62, 81), (66, 81))
    arrow(ax, (47, 72), (47, 66))
    arrow(ax, (62, 56), (66, 56))
    arrow(ax, (47, 46), (47, 40))
    arrow(ax, (47, 40), (46, 40))
    arrow(ax, (77, 46), (81, 40))
    save(fig, "fig-09-contractor-data-flow.png")


# ---------------------------------------------------------------------------
# 10. GitHub, Arena, build and deployment
# ---------------------------------------------------------------------------
def figure_10():
    fig, ax = canvas()
    title(ax, "Figure 10 · GitHub, Arena, build and deployment workflow", "Every artefact traces back to a commit on the repository")

    stages = [
        (1, "Arena branch", ["arena/ec593218-…", "session-locked"]),
        (21, "GitHub repository", ["sarthakjain5610/Shramset8.0", "PRs #11 and #12"]),
        (41, "CI-equivalent scripts", ["tsc · 7 test suites", "no server required"]),
        (61, "Vite build", ["dist/ static bundle", "code-split dashboards"]),
        (81, "Cloudflare Workers", ["wrangler.jsonc assets", "wurkup…workers.dev"]),
    ]
    for x, heading, lines in stages:
        box(ax, x, 64, 17, 20, heading, lines, fontsize=9.0)
    for index in range(len(stages) - 1):
        arrow(ax, (stages[index][0] + 17, 74), (stages[index + 1][0], 74))

    band(ax, 2, 34, 96, 24, "BRANCH AND REVIEW RULES")
    box(ax, 4, 35.5, 29, 17, "One session, one branch", ["work lands on the", "Arena branch only"], fill="white")
    box(ax, 36, 35.5, 29, 17, "Pull request per feature", ["PR #11 auth · PR #12 dashboards", "never force-pushed"], fill="white")
    box(ax, 68, 35.5, 28, 17, "No auto-merge", ["human approval expected", "no production DB change"], fill=ROSE_LIGHT, edge=ROSE)

    band(ax, 2, 10, 96, 20, "BUILD OUTPUT")
    box(ax, 4, 11.5, 29, 13, "assets/*.js + *.css", ["hashed filenames", "fonts self-hosted"], fill=FOREST_LIGHT)
    box(ax, 36, 11.5, 29, 13, "index.html", ["hash router entry", "single HTML shell"], fill=FOREST_LIGHT)
    box(ax, 68, 11.5, 28, 13, "404-page handling", ["unknown hash → NotFound", "configured in wrangler"], fill=FOREST_LIGHT)
    arrow(ax, (50, 64), (50, 58))
    save(fig, "fig-10-deployment.png")


# ---------------------------------------------------------------------------
# 11. SMTP and e-mail delivery
# ---------------------------------------------------------------------------
def figure_11():
    fig, ax = canvas()
    title(ax, "Figure 11 · SMTP and e-mail delivery architecture", "Configured in Supabase Auth; delivery depends on Brevo-side state")

    box(ax, 1, 78, 22, 15, "App", ["signUp()", "resetPasswordForEmail()"], fill=BRASS_LIGHT, edge=BRASS)
    box(ax, 26, 78, 21, 15, "Supabase Auth (GoTrue)", ["SMTP host configured", "smtp-relay.brevo.com:587"])
    box(ax, 64, 78, 22, 15, "Brevo relay", ["sender: WURK UP", "relay state: see §10.2"], fill=ROSE_LIGHT, edge=ROSE)

    box(ax, 1, 52, 48, 20, "Templates held in Supabase Auth (read through the provider API)", [
        "Confirm your email address  ·  Reset your password",
        "magic link  ·  invite  ·  email change",
        "password / email changed notifications (disabled)",
    ], fill="white", fontsize=8.4)

    box(ax, 64, 52, 22, 14, "Recipient inbox", ["confirmation or", "recovery message"], fill="white", edge=ROSE)

    box(ax, 1, 30, 48, 18, "Implemented in the app", [
        "sign-up with emailRedirectTo",
        "forgot-password request + recovery screen",
        "rate-limit, expired-link and resend copy",
    ], fill=FOREST_LIGHT, fontsize=8.4)

    box(ax, 64, 22, 34, 26, "Delivery preconditions (outside the repository)", [
        "1. Brevo SMTP relay switched on",
        "2. sender domain authenticated (SPF/DKIM)",
        "3. sender identity verified",
        "4. account not blocked, quota left",
        "5. recipient not suppressed",
    ], fill=SAND, edge=BRASS, fontsize=8.4)

    box(ax, 1, 6, 98, 14, "Status: CONFIGURED BUT UNVERIFIED", [
        "Supabase holds Brevo SMTP credentials and a template set; no delivery test was executed in this",
        "environment, so arrival in a real inbox remains unproven.",
    ], fill=ROSE_LIGHT, edge=ROSE, fontsize=8.4)

    arrow(ax, (23, 85.5), (26, 85.5))
    arrow(ax, (47, 85.5), (64, 85.5), label="SMTP 587 · STARTTLS", label_offset=(0, 0.9))
    arrow(ax, (75, 78), (75, 66))
    save(fig, "fig-11-smtp.png")


# ---------------------------------------------------------------------------
# 12. Provider integration architecture
# ---------------------------------------------------------------------------
def figure_12():
    fig, ax = canvas()
    title(ax, "Figure 12 · Third-party provider integration map", "What is reachable from the browser, what only exists in configuration")

    box(ax, 36, 40, 28, 20, "Browser application", ["no server-side secrets", "publishable key only"], fill=BRASS_LIGHT, edge=BRASS)

    providers = [
        (2, 74, "Supabase", ["Auth · PostgREST · Postgres", "VERIFIED ACTIVE"], FOREST_LIGHT, FOREST),
        (36, 74, "Cloudflare Workers", ["static hosting", "CONFIGURED · workers.dev"], FOREST_LIGHT, FOREST),
        (70, 74, "Brevo", ["SMTP relay", "CONFIGURED BUT UNVERIFIED"], ROSE_LIGHT, ROSE),
        (2, 8, "Google GenAI", ["dependency declared", "NOT USED IN SRC"], SAND, GREY),
        (36, 8, "GitHub", ["source of truth · PRs", "VERIFIED ACTIVE"], FOREST_LIGHT, FOREST),
        (70, 8, "Arena", ["agent session · branch", "VERIFIED ACTIVE"], FOREST_LIGHT, FOREST),
    ]
    for x, y, heading, lines, fill, edge in providers:
        box(ax, x, y, 28, 16, heading, lines, fill=fill, edge=edge)

    arrow(ax, (38, 60), (18, 74), label="HTTPS · REST + auth", label_offset=(-1.5, -4.6))
    arrow(ax, (50, 74), (50, 60), style="<|-|>", label="static assets over HTTPS 443", label_offset=(11, 0.4))
    ax.text(84, 66, "reached only by Supabase Auth", fontsize=7.0, color=ROSE, ha="center")
    ax.text(2, 33, "No browser request ever reaches Brevo directly: Supabase Auth sends the message through the SMTP",
            fontsize=7.6, color=GREY)
    ax.text(2, 29.4, "credentials held server-side, so the browser never holds an SMTP password.",
            fontsize=7.6, color=GREY)
    save(fig, "fig-12-providers.png")


if __name__ == "__main__":
    figure_01()
    figure_02()
    figure_03()
    figure_04()
    figure_05()
    figure_06()
    figure_07()
    figure_08()
    figure_09()
    figure_10()
    figure_11()
    figure_12()

    print()
    for key in sorted(CAPTIONS):
        text, subtitle = CAPTIONS[key]
        print("%-22s %s | %s" % (key, text, subtitle or ""))
