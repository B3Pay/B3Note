export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'Ok' : IDL.Text, 'Err' : IDL.Text });
  const EncryptedText = IDL.Record({
    'time_lock' : IDL.Nat64,
    'public_key' : IDL.Vec(IDL.Nat8),
    'plain_text' : IDL.Text,
  });
  const Result_1 = IDL.Variant({ 'Ok' : IDL.Bool, 'Err' : IDL.Text });
  return IDL.Service({
    'decrypt_text' : IDL.Func([IDL.Text, IDL.Text], [Result], []),
    'encrypted_ibe_decryption_key_for_caller' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [IDL.Text],
        [],
      ),
    'encrypted_symmetric_key_for_caller' : IDL.Func(
        [IDL.Vec(IDL.Nat8)],
        [IDL.Text],
        [],
      ),
    'get_encrypted_text' : IDL.Func(
        [IDL.Vec(IDL.Nat8), IDL.Nat64],
        [IDL.Text],
        [],
      ),
    'get_encrypted_texts' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Nat64, EncryptedText))],
        ['query'],
      ),
    'ibe_encryption_key' : IDL.Func([], [IDL.Text], []),
    'read_encrypted_text' : IDL.Func([IDL.Nat64], [IDL.Text], []),
    'save_encrypted_text' : IDL.Func([EncryptedText], [], []),
    'symmetric_key_verification_key' : IDL.Func([], [IDL.Text], []),
    'symmetric_key_verification_key_for' : IDL.Func(
        [IDL.Opt(IDL.Principal)],
        [IDL.Text],
        [],
      ),
    'verify_caller' : IDL.Func([IDL.Text, IDL.Text, IDL.Text], [Result_1], []),
    'verify_ownership_caller' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text],
        [IDL.Bool],
        [],
      ),
    'verify_signature_with_encrypted_key_caller' : IDL.Func(
        [IDL.Text, IDL.Text],
        [IDL.Bool],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
