pub enum MemoryPartition {
    TaskTimer,
    TextCounter,
    EncryptedTexts,
    IdentifiedUsers,
    AnonymousUsers,
    OneTimeKeys,
}

impl MemoryPartition {
    pub fn id(self) -> u8 {
        match self {
            MemoryPartition::TaskTimer => 1,
            MemoryPartition::TextCounter => 2,
            MemoryPartition::EncryptedTexts => 3,
            MemoryPartition::IdentifiedUsers => 4,
            MemoryPartition::AnonymousUsers => 5,
            MemoryPartition::OneTimeKeys => 6,
        }
    }
}
