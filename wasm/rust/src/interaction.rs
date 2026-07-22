use k4_manifold::parser::K4Parser;

// The bridge/UI calls engine.step() with the user's plain text after AwaitUser.
// After cold start is consumed, step() sends `input` through K4Parser::parse.
// Reproduce that here — with plain user text, not structured LLM output.
#[test]
fn plain_user_reply_after_await_user_shears() {
    let parser = K4Parser::new();
    let user_reply = "yes, let's continue with the extraction";
    let result = parser.parse(user_reply);
    assert!(result.is_err(), "expected parse to fail, got {:?}", result);
    let msg = format!("{:?}", result.unwrap_err());
    assert!(msg.contains("Missing [STATE]"),
        "expected missing [STATE] header shear, got: {}", msg);
    // In the engine this becomes JsCommand::Halt { reason: "Structural Shear: ..." }
    // The UI shows HALT and the run is dead.
}

// Any answer with an em-dash or paragraph — no header — still shears.
#[test]
fn richer_user_reply_still_shears() {
    let parser = K4Parser::new();
    let user_reply = "The anchor should be quality — and I'm leaning capacitive on the P4 offer.";
    assert!(parser.parse(user_reply).is_err());
}
