// Verifies the StepMode patch: after AwaitUser, the next user reply is
// treated as a payload (recompiled into a continuation prompt), not fed to
// the parser. This is the concrete fix for the "second-turn shear" that
// tests/interaction.rs demonstrated existed under the old is_cold_start bool.

use k4_manifold::engine::{K4Engine, StepMode, JsCommand};

/// Full validator-format LLM output — parses cleanly, hits PlainText, triggers AwaitUser.
fn llm_await_user_response() -> &'static str {
    "[STATE] CYCLE: 1 | SEQ: 0 | STANCE: Synthesis (P = U × I) | PLANE: P-Face | HELD: R=nil | \
     PATH: P>U>I>R | FACE: P | RAISES: 0/3 | STATUS: run\n\
     [COMPUTATION]\nfacet probe complete\n[/COMPUTATION]\n\
     I'm reading a tension in your material. Does this land, or does it slide off?"
}

#[test]
fn cold_start_wraps_user_input_into_validator_prompt() {
    let mut e = K4Engine::new();
    assert_eq!(e.mode(), StepMode::ColdStart);

    let cmd = e.step_command("hello, please help me structure this project");

    // Cold-start emits a FetchLLM (the validator prompt) and transitions to ExpectLlm.
    match cmd {
        JsCommand::FetchLLM { prompt } => {
            assert!(prompt.contains("K4-AlgebraicIntakeValidator"),
                "cold-start prompt should name the Validator role, got:\n{}", prompt);
            assert!(prompt.contains("hello, please help me structure"),
                "cold-start prompt should carry user input, got:\n{}", prompt);
        }
        other => panic!("expected FetchLLM after cold start, got {:?}", debug(&other)),
    }
    assert_eq!(e.mode(), StepMode::ExpectLlm);
}

#[test]
fn plain_text_llm_output_flips_engine_to_expect_user() {
    let mut e = K4Engine::new();
    e.step_command("some intent");                // ColdStart → ExpectLlm
    assert_eq!(e.mode(), StepMode::ExpectLlm);

    let cmd = e.step_command(llm_await_user_response());
    match cmd {
        JsCommand::AwaitUser { text } => {
            assert!(text.contains("slide off"), "got: {}", text);
        }
        other => panic!("expected AwaitUser, got {:?}", debug(&other)),
    }
    assert_eq!(e.mode(), StepMode::ExpectUser);
}

/// The regression test. This is the exact scenario tests/interaction.rs proved
/// used to HALT. Now it should recompile the user's plain reply into a
/// continuation prompt and emit FetchLLM.
#[test]
fn user_reply_after_await_user_is_recompiled_not_parsed() {
    let mut e = K4Engine::new();
    e.step_command("some intent");
    e.step_command(llm_await_user_response());     // → ExpectUser
    assert_eq!(e.mode(), StepMode::ExpectUser);

    let cmd = e.step_command("yes, that's exactly the tension I'm holding");

    match cmd {
        JsCommand::FetchLLM { prompt } => {
            // The user's raw reply is wrapped into the appropriate role's
            // prompt (in this test, the Controller — the AwaitUser fired from
            // a Controller-classified header), not parsed as an LLM output.
            assert!(prompt.contains("K4-AlgebraicSwarmController"),
                "expected Controller-role continuation prompt, got:\n{}", prompt);
            assert!(prompt.contains("that's exactly the tension"),
                "prompt should carry the user's reply verbatim:\n{}", prompt);
        }
        JsCommand::Halt { reason } => panic!("regression: engine halted on user reply: {}", reason),
        other => panic!("expected FetchLLM, got {:?}", debug(&other)),
    }
    assert_eq!(e.mode(), StepMode::ExpectLlm);
}

#[test]
fn expect_llm_still_halts_on_unstructured_input() {
    // The old behavior is preserved for the ExpectLlm path — an LLM that
    // returns malformed text still shears. The fix only changes the
    // ExpectUser path.
    let mut e = K4Engine::new();
    e.step_command("intent");                      // ColdStart → ExpectLlm
    let cmd = e.step_command("no state header here, malformed llm");
    match cmd {
        JsCommand::Halt { reason } => {
            assert!(reason.contains("Structural Shear"), "got: {}", reason);
        }
        other => panic!("expected Halt on malformed LLM input, got {:?}", debug(&other)),
    }
}

#[test]
fn multi_turn_operator_conversation_survives() {
    // The whole point: cold → LLM → AwaitUser → operator reply → LLM → AwaitUser → ...
    // should keep alternating without a HALT.
    let mut e = K4Engine::new();

    e.step_command("initial intent");                     // cold  → ExpectLlm
    e.step_command(llm_await_user_response());            // Bridge asks → ExpectUser
    let cmd = e.step_command("here's my clarification");  // operator replies → ExpectLlm
    assert!(matches!(cmd, JsCommand::FetchLLM { .. }));
    assert_eq!(e.mode(), StepMode::ExpectLlm);

    // Round 2: Bridge asks again with a slightly different articulation.
    let another_bridge_turn = "[STATE] CYCLE: 2 | SEQ: 3 | STANCE: Leverage (P = U² / R) | PLANE: P-Face | \
                               HELD: I=nil | PATH: P>U>R | FACE: P | RAISES: 0/3 | STATUS: run\n\
                               [COMPUTATION]\ndifferent facet now\n[/COMPUTATION]\n\
                               And this next tension — is it live too?";
    let cmd2 = e.step_command(another_bridge_turn);
    assert!(matches!(cmd2, JsCommand::AwaitUser { .. }));
    assert_eq!(e.mode(), StepMode::ExpectUser);

    let cmd3 = e.step_command("still ringing, keep going");
    assert!(matches!(cmd3, JsCommand::FetchLLM { .. }));
    assert_eq!(e.mode(), StepMode::ExpectLlm);
}

fn debug(cmd: &JsCommand) -> String { format!("{:?}", cmd) }
