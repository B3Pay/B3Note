export const idlFactory = ({ IDL }) => {
  const Limits = IDL.Record({
    max_note_bytes: IDL.Nat32,
    key_requests_per_user_per_hour: IDL.Nat32,
    ai_requests_per_user_per_hour: IDL.Nat32,
    global_key_requests_per_hour: IDL.Nat32,
    max_share_ttl_secs: IDL.Nat64,
    max_share_views: IDL.Nat32,
    max_notes_per_user: IDL.Nat32,
    max_ai_input_bytes: IDL.Nat32,
    max_shares_per_user: IDL.Nat32,
    global_ai_requests_per_hour: IDL.Nat32,
  })
  const InitArgs = IDL.Record({
    ai_enabled: IDL.Opt(IDL.Bool),
    llm_cycles_per_call: IDL.Opt(IDL.Nat64),
    llm_model: IDL.Opt(IDL.Text),
    llm_canister: IDL.Opt(IDL.Principal),
    limits: IDL.Opt(Limits),
    vetkd_key_name: IDL.Opt(IDL.Text),
  })
  const AiTask = IDL.Variant({
    Ask: IDL.Text,
    Continue: IDL.Null,
    FixGrammar: IDL.Null,
    Improve: IDL.Null,
    Shorten: IDL.Null,
    ActionItems: IDL.Null,
    SuggestTitle: IDL.Null,
    Translate: IDL.Text,
    SuggestTags: IDL.Null,
    Summarize: IDL.Null,
  })
  const AiRequest = IDL.Record({ task: AiTask, text: IDL.Text })
  const AiResponse = IDL.Record({ model: IDL.Text, text: IDL.Text })
  const Error = IDL.Variant({
    Ai: IDL.Text,
    Exhausted: IDL.Null,
    NotReady: IDL.Null,
    NotFound: IDL.Null,
    AlreadyExists: IDL.Null,
    RateLimited: IDL.Record({ retry_after_secs: IDL.Nat64 }),
    AiDisabled: IDL.Null,
    InvalidArgument: IDL.Text,
    VetKd: IDL.Text,
    Forbidden: IDL.Text,
    Expired: IDL.Null,
    QuotaExceeded: IDL.Text,
    Unauthenticated: IDL.Null,
    Conflict: IDL.Record({ current_version: IDL.Nat64 }),
  })
  const Result = IDL.Variant({ Ok: AiResponse, Err: Error })
  const CreateNoteArgs = IDL.Record({
    id: IDL.Text,
    ciphertext: IDL.Vec(IDL.Nat8),
    expires_at: IDL.Opt(IDL.Nat64),
  })
  const Note = IDL.Record({
    id: IDL.Text,
    updated_at: IDL.Nat64,
    ciphertext: IDL.Vec(IDL.Nat8),
    created_at: IDL.Nat64,
    version: IDL.Nat64,
    expires_at: IDL.Opt(IDL.Nat64),
  })
  const Result_1 = IDL.Variant({ Ok: Note, Err: Error })
  const CreateShareArgs = IDL.Record({
    id: IDL.Text,
    verifying_key: IDL.Vec(IDL.Nat8),
    ciphertext: IDL.Vec(IDL.Nat8),
    max_views: IDL.Nat32,
    note_id: IDL.Opt(IDL.Text),
    expires_in_secs: IDL.Nat64,
  })
  const ShareInfo = IDL.Record({
    id: IDL.Text,
    views_left: IDL.Nat32,
    max_views: IDL.Nat32,
    size: IDL.Nat32,
    note_id: IDL.Opt(IDL.Text),
    created_at: IDL.Nat64,
    expires_at: IDL.Nat64,
  })
  const Result_2 = IDL.Variant({ Ok: ShareInfo, Err: Error })
  const DeletedAccount = IDL.Record({
    shares: IDL.Nat32,
    notes: IDL.Nat32,
  })
  const Result_3 = IDL.Variant({ Ok: DeletedAccount, Err: Error })
  const Result_4 = IDL.Variant({ Ok: IDL.Null, Err: Error })
  const Account = IDL.Record({
    principal: IDL.Principal,
    share_count: IDL.Nat32,
    ai_enabled: IDL.Bool,
    created_at: IDL.Nat64,
    note_count: IDL.Nat32,
    storage_bytes: IDL.Nat64,
    ai_model: IDL.Text,
    limits: Limits,
  })
  const Result_5 = IDL.Variant({ Ok: Account, Err: Error })
  const Config = IDL.Record({
    ai_enabled: IDL.Bool,
    llm_cycles_per_call: IDL.Nat64,
    llm_model: IDL.Text,
    llm_canister: IDL.Opt(IDL.Principal),
    limits: Limits,
    vetkd_key_name: IDL.Text,
  })
  const EncryptedUserKey = IDL.Record({
    encrypted_key: IDL.Vec(IDL.Nat8),
    verification_key: IDL.Vec(IDL.Nat8),
  })
  const Result_6 = IDL.Variant({ Ok: EncryptedUserKey, Err: Error })
  const PublicKeys = IDL.Record({
    user_key: IDL.Vec(IDL.Nat8),
    share_key: IDL.Vec(IDL.Nat8),
  })
  const Result_7 = IDL.Variant({ Ok: PublicKeys, Err: Error })
  const PublicShareInfo = IDL.Record({
    views_left: IDL.Nat32,
    size: IDL.Nat32,
    created_at: IDL.Nat64,
    expires_at: IDL.Nat64,
  })
  const Result_8 = IDL.Variant({ Ok: PublicShareInfo, Err: Error })
  const Stats = IDL.Record({
    ai_enabled: IDL.Bool,
    active_shares: IDL.Nat64,
    version: IDL.Text,
    cycles: IDL.Nat,
    notes: IDL.Nat64,
    users: IDL.Nat64,
    ai_model: IDL.Text,
    vetkd_key_name: IDL.Text,
  })
  const ListNotesArgs = IDL.Record({
    cursor: IDL.Opt(IDL.Text),
    limit: IDL.Opt(IDL.Nat32),
  })
  const NotePage = IDL.Record({
    notes: IDL.Vec(Note),
    next_cursor: IDL.Opt(IDL.Text),
  })
  const Result_9 = IDL.Variant({ Ok: NotePage, Err: Error })
  const Result_10 = IDL.Variant({ Ok: IDL.Vec(ShareInfo), Err: Error })
  const OpenShareArgs = IDL.Record({
    id: IDL.Text,
    signature: IDL.Vec(IDL.Nat8),
    transport_public_key: IDL.Vec(IDL.Nat8),
  })
  const OpenedShare = IDL.Record({
    views_left: IDL.Nat32,
    encrypted_key: IDL.Vec(IDL.Nat8),
    ciphertext: IDL.Vec(IDL.Nat8),
    verification_key: IDL.Vec(IDL.Nat8),
    expires_at: IDL.Nat64,
  })
  const Result_11 = IDL.Variant({ Ok: OpenedShare, Err: Error })
  const Result_12 = IDL.Variant({ Ok: Config, Err: Error })
  const UpdateNoteArgs = IDL.Record({
    id: IDL.Text,
    ciphertext: IDL.Vec(IDL.Nat8),
    expires_at: IDL.Opt(IDL.Nat64),
    expected_version: IDL.Opt(IDL.Nat64),
  })
  return IDL.Service({
    ai_assist: IDL.Func([AiRequest], [Result], []),
    create_note: IDL.Func([CreateNoteArgs], [Result_1], []),
    create_share: IDL.Func([CreateShareArgs], [Result_2], []),
    delete_account: IDL.Func([], [Result_3], []),
    delete_note: IDL.Func([IDL.Text], [Result_4], []),
    get_account: IDL.Func([], [Result_5], ["query"]),
    get_config: IDL.Func([], [Config], ["query"]),
    get_encrypted_user_key: IDL.Func([IDL.Vec(IDL.Nat8)], [Result_6], []),
    get_note: IDL.Func([IDL.Text], [Result_1], ["query"]),
    get_public_keys: IDL.Func([], [Result_7], ["query"]),
    get_share: IDL.Func([IDL.Text], [Result_8], ["query"]),
    get_stats: IDL.Func([], [Stats], ["query"]),
    list_notes: IDL.Func([ListNotesArgs], [Result_9], ["query"]),
    list_shares: IDL.Func([], [Result_10], ["query"]),
    load_public_keys: IDL.Func([], [Result_7], []),
    open_share: IDL.Func([OpenShareArgs], [Result_11], []),
    revoke_share: IDL.Func([IDL.Text], [Result_4], []),
    update_config: IDL.Func([InitArgs], [Result_12], []),
    update_note: IDL.Func([UpdateNoteArgs], [Result_1], []),
    whoami: IDL.Func([], [IDL.Principal], ["query"]),
  })
}
export const init = ({ IDL }) => {
  const Limits = IDL.Record({
    max_note_bytes: IDL.Nat32,
    key_requests_per_user_per_hour: IDL.Nat32,
    ai_requests_per_user_per_hour: IDL.Nat32,
    global_key_requests_per_hour: IDL.Nat32,
    max_share_ttl_secs: IDL.Nat64,
    max_share_views: IDL.Nat32,
    max_notes_per_user: IDL.Nat32,
    max_ai_input_bytes: IDL.Nat32,
    max_shares_per_user: IDL.Nat32,
    global_ai_requests_per_hour: IDL.Nat32,
  })
  const InitArgs = IDL.Record({
    ai_enabled: IDL.Opt(IDL.Bool),
    llm_cycles_per_call: IDL.Opt(IDL.Nat64),
    llm_model: IDL.Opt(IDL.Text),
    llm_canister: IDL.Opt(IDL.Principal),
    limits: IDL.Opt(Limits),
    vetkd_key_name: IDL.Opt(IDL.Text),
  })
  return [IDL.Opt(InitArgs)]
}
