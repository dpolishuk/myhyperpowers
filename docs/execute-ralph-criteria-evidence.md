# Execute-Ralph Criteria Evidence

This document maps `bd-heu` success criteria to deterministic evidence artifacts.

## Verification Commands

- `node --test tests/execute-ralph-contract.test.js`
- `node --test tests/codex-*.test.js`
- `node --test tests/*.test.js`
- `node scripts/sync-codex-skills.js --check`

## Pre-commit-equivalent verification path

In guarded environments, direct .git/hooks/pre-commit execution may be blocked by safety guardrails.
Use the verification command sequence above as pre-commit-equivalent evidence for this epic.

## Criterion to Evidence Mapping

1. **Running /execute-ralph continues autonomously when criteria remain unmet**
   - Evidence: `tests/execute-ralph-contract.test.js`
   - Assertions: `test_execute_ralph_continues_when_criteria_unmet`, `test_execute_ralph_auto_creates_and_refines_next_task`

2. **/execute-plan still stops after each task**
   - Evidence: `tests/execute-ralph-contract.test.js`
   - Assertions: `test_execute_plan_still_stops_after_single_task`

3. **Final close path requires both reviewer approvals**
   - Evidence: `tests/execute-ralph-contract.test.js`
   - Assertions: `test_dual_final_gate_requires_both_approvals`, `test_mixed_final_verdicts_do_not_close_epic`, `test_final_gate_mixed_verdict_routes_to_remediation`

4. **No-progress remediation continues until retry threshold (50) then escalates**
   - Evidence: `tests/execute-ralph-contract.test.js`
   - Assertions: `test_no_progress_cycles_until_retry_50_then_escalates`

5. **Deterministic tests cover loop transitions, verdict mapping, and intent isolation**
   - Evidence: `tests/execute-ralph-contract.test.js`
   - Assertions: `test_verdict_matrix_contains_all_supported_tokens`, `test_unknown_verdict_forces_remediation_path`, `test_execute_ralph_intent_not_overridden_by_context_pack`, `test_execute_ralph_intent_has_explicit_activation_rule`, `test_execute_ralph_contract_consistency_across_source_and_wrappers`, `test_quality_gate_sequence_declared_and_verified`

6. **All related tests and checks pass**
   - Evidence commands:
     - `node --test tests/execute-ralph-contract.test.js`
     - `node --test tests/codex-*.test.js`
     - `node --test tests/*.test.js`
     - `node scripts/sync-codex-skills.js --check`
