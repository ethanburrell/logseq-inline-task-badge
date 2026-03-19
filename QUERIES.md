# logseq-inline-task-badge — Queries

Paste any of these into a Logseq page to create a live view of your tasks.

## All tasks (sorted by status)

```clojure
#+BEGIN_QUERY
{:title "All Tasks"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "renderer :task-status")]]
 :result-transform (fn [blocks]
   (sort-by
     (fn [b]
       (let [c (get b :block/content "")]
         (cond
           (clojure.string/includes? c "task-status, Not Started")  0
           (clojure.string/includes? c "task-status, In Progress")  1
           (clojure.string/includes? c "task-status, In Review")    2
           (clojure.string/includes? c "task-status, Merged")       3
           (clojure.string/includes? c "task-status, Deployed")     4
           (clojure.string/includes? c "task-status, Comms Sent")   5
           (clojure.string/includes? c "task-status, Completed")    6
           :else                                                     99)))
     blocks))}
#+END_QUERY
```

## Per-status views

### Not Started
```clojure
#+BEGIN_QUERY
{:title "Not Started"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, Not Started")]]}
#+END_QUERY
```

### In Progress
```clojure
#+BEGIN_QUERY
{:title "In Progress"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, In Progress")]]}
#+END_QUERY
```

### In Review
```clojure
#+BEGIN_QUERY
{:title "In Review"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, In Review")]]}
#+END_QUERY
```

### Merged
```clojure
#+BEGIN_QUERY
{:title "Merged"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, Merged")]]}
#+END_QUERY
```

### Deployed
```clojure
#+BEGIN_QUERY
{:title "Deployed"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, Deployed")]]}
#+END_QUERY
```

### Comms Sent
```clojure
#+BEGIN_QUERY
{:title "Comms Sent"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, Comms Sent")]]}
#+END_QUERY
```

### Completed
```clojure
#+BEGIN_QUERY
{:title "Completed"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "task-status, Completed")]]}
#+END_QUERY
```

## Active work (not yet completed)

```clojure
#+BEGIN_QUERY
{:title "Active Tasks"
 :query [:find (pull ?b [*])
         :where
         [?b :block/content ?c]
         [(clojure.string/includes? ?c "renderer :task-status")]
         (not [(clojure.string/includes? ?c "task-status, Completed")])
         (not [(clojure.string/includes? ?c "task-status, Not Started")])]}
#+END_QUERY
```

## Notes

- Each query matches the raw macro text stored in the block, so they work even while the badge is rendered.
- The "All Tasks" query sorts by workflow order using `result-transform`. Update the `cond` labels if you customise your statuses.
- Queries are live — they update as you change task statuses.
