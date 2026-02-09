# Concurrency and IPC Trap Catalog

| Trap | Symptoms | Risk | Refactor Direction |
|---|---|---|---|
| Holding locks across IPC/XPC | Mutex held during IPC call | Deadlocks, priority inversion | Release locks before IPC; copy data first |
| Lock ordering inversion | Different subsystems lock in different orders | Deadlocks | Define global lock order; enforce |
| Synchronous call on same serial queue | sync dispatch to same queue | Deadlock | Use async or re-architect queue usage |
| Blocking while holding a shared lock | Waits on condition while locked | Starvation, deadlock | Use condition variables without holding locks |
| Calling user callbacks under lock | Invoking external code while locked | Re-entrancy deadlock | Drop lock before callback |
| Mixed sync/async on same resource | Race conditions with unclear ownership | Data races | Single-threaded ownership or explicit synchronization |
| Shared mutable state without ownership | Many writers | Races, heisenbugs | Encapsulate state, single owner, DI |
| No timeout or cancellation for IPC | Calls can hang | Resource leakage | Add timeouts and cancellation paths |
