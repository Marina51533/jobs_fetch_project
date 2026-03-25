#!/usr/bin/env python3
"""
Job classifier for QA vs Developer roles.

Reads JSON job array from stdin, writes classification results to stdout.
Uses configurable keyword matching with confidence scoring.

Usage:
  echo '[{"title":"QA Engineer","description":"...","location":"Berlin"}]' | python3 classify.py
"""

import json
import sys
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")


def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def match_keywords(text, keywords_by_strength, scoring, source_type):
    """
    Match text against keyword lists. Returns (score, matched_keywords).
    source_type is 'title' or 'description'.
    """
    text_lower = text.lower()
    total_score = 0.0
    matched = []

    for strength in ["strong", "moderate", "weak"]:
        keywords = keywords_by_strength.get(strength, [])
        score_key = f"{strength}_{source_type}_match"
        score_value = scoring.get(score_key, 0)

        for kw in keywords:
            pattern = re.compile(re.escape(kw.lower()), re.IGNORECASE)
            if pattern.search(text_lower):
                total_score += score_value
                matched.append(f"{strength}:{kw}")

    return total_score, matched


def check_exclusions(text, exclude_keywords):
    """Check if text matches any exclusion keywords."""
    text_lower = text.lower()
    for kw in exclude_keywords:
        if kw.lower() in text_lower:
            return True, kw
    return False, None


def classify_job(job, config):
    """
    Classify a single job. Returns dict with label, confidence, reasons.
    """
    title = job.get("title", "")
    description = job.get("description", "")
    scoring = config["scoring"]

    # Check exclusions first
    excluded, exclude_kw = check_exclusions(title, config.get("exclude_keywords", []))
    if excluded:
        return {
            "label": "Uncertain",
            "confidence": 0.1,
            "reasons": [f"excluded_keyword:{exclude_kw}"],
        }

    # Score QA
    qa_title_score, qa_title_matches = match_keywords(
        title, config["qa_keywords"], scoring, "title"
    )
    qa_desc_score, qa_desc_matches = match_keywords(
        description, config["qa_keywords"], scoring, "description"
    )
    qa_total = qa_title_score + qa_desc_score
    qa_reasons = qa_title_matches + qa_desc_matches

    # Score Developer
    dev_title_score, dev_title_matches = match_keywords(
        title, config["developer_keywords"], scoring, "title"
    )
    dev_desc_score, dev_desc_matches = match_keywords(
        description, config["developer_keywords"], scoring, "description"
    )
    dev_total = dev_title_score + dev_desc_score
    dev_reasons = dev_title_matches + dev_desc_matches

    # Determine label
    threshold = config.get("confidence_threshold", 0.8)

    if qa_total == 0 and dev_total == 0:
        return {
            "label": "Uncertain",
            "confidence": 0.0,
            "reasons": ["no_keyword_match"],
        }

    if qa_total > dev_total:
        confidence = min(qa_total, 1.0)
        label = "QA" if confidence >= threshold else "Uncertain"
        return {
            "label": label,
            "confidence": round(confidence, 2),
            "reasons": qa_reasons,
        }

    if dev_total > qa_total:
        confidence = min(dev_total, 1.0)
        label = "Developer" if confidence >= threshold else "Uncertain"
        return {
            "label": label,
            "confidence": round(confidence, 2),
            "reasons": dev_reasons,
        }

    # Tie — uncertain
    confidence = min(max(qa_total, dev_total), 1.0)
    return {
        "label": "Uncertain",
        "confidence": round(confidence, 2),
        "reasons": qa_reasons + dev_reasons + ["tie_between_qa_and_dev"],
    }


def main():
    config = load_config()
    raw_input = sys.stdin.read()
    jobs = json.loads(raw_input)

    results = []
    for job in jobs:
        result = classify_job(job, config)
        results.append(result)

    print(json.dumps(results))


if __name__ == "__main__":
    main()
