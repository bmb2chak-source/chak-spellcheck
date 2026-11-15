import { send } from './_lib/http.js';
import { isPaywallEnabled } from './_lib/qpay.js';
import { PLANS, TRIAL_DAYS } from './_lib/plans.js';

export default function handler(req, res) {
  send(res, 200, { paywall: isPaywallEnabled(), trialDays: TRIAL_DAYS, plans: Object.values(PLANS) });
}
