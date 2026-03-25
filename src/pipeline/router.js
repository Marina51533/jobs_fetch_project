/**
 * Combine classification result and geography filter into a final decision.
 *
 * Decision matrix (stricter wins):
 *   Confident (QA/Dev) + publish  → auto_publish
 *   Confident (QA/Dev) + review   → review
 *   Confident (QA/Dev) + reject   → reject
 *   Uncertain          + publish  → review
 *   Uncertain          + review   → review
 *   Uncertain          + reject   → reject
 *
 * @param {object} classification - { label, confidence, reasons }
 * @param {string} geoDecision - 'publish' | 'reject' | 'review'
 * @param {number} confidenceThreshold
 * @returns {{ final_decision, review_status, publish_target }}
 */
export function routeJob(classification, geoDecision, confidenceThreshold = 0.8) {
  const { label, confidence } = classification;
  const isConfident = label !== 'Uncertain' && confidence >= confidenceThreshold;

  // Reject always wins
  if (geoDecision === 'reject') {
    return {
      final_decision: 'reject',
      review_status: null,
      publish_target: null,
    };
  }

  // Either stage says review → review
  if (!isConfident || geoDecision === 'review') {
    return {
      final_decision: 'review',
      review_status: 'pending',
      publish_target: null,
    };
  }

  // Both pass → auto-publish
  const target = label === 'QA' ? 'qa' : 'developer';
  return {
    final_decision: 'auto_publish',
    review_status: null,
    publish_target: target,
  };
}
