use b3_utils::memory::{timer::TaskTimerPartition, with_stable_memory_mut};
use std::cell::RefCell;

use crate::stable::MemoryPartition;

use super::Task;

type TaskTimer = TaskTimerPartition<Task>;

thread_local! {
    pub static TASK_TIMER: RefCell<TaskTimerPartition<Task>> = RefCell::new(with_stable_memory_mut(|pm| TaskTimerPartition::init(pm, MemoryPartition::TaskTimer.id())));
}

pub fn with_task_timer<F, R>(f: F) -> R
where
    F: FnOnce(&mut TaskTimer) -> R,
{
    TASK_TIMER.with(|task_timer| f(&mut *task_timer.borrow_mut()))
}
