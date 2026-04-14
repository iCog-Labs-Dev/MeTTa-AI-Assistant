use std::io::Cursor;
use wasm_bindgen::prelude::*;

use hyperon::metta::runner::{EnvBuilder, Metta};
use hyperon::metta::text::SExprParser;

#[wasm_bindgen]
pub fn run_metta(code: &str) -> String {
    let env = EnvBuilder::test_env();
    let metta = Metta::new(Some(env));

    let input = Cursor::new(code.as_bytes());

    match metta.run(SExprParser::new(input)) {
        Ok(results) => {
            if results.is_empty() {
                "(no result)".to_string()
            } else {
                results
                    .iter()
                    .map(|atoms| {
                        if atoms.is_empty() {
                            "()".to_string()
                        } else {
                            atoms.iter()
                                .map(|atom| atom.to_string())
                                .collect::<Vec<_>>()
                                .join(" ")
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("\n")
            }
        }
        Err(err) => format!("Error: {err}"),
    }
}