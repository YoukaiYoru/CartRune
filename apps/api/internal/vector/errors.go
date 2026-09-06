package vector

import "errors"

// ErrUnavailable is returned when the Qdrant client could not be constructed
// (connection pool setup failed at boot) or the server is unreachable.
var ErrUnavailable = errors.New("vector store unavailable")

// ErrNotReady is returned when a search/upsert is attempted before the
// collection exists (EnsureCollection not run or Qdrant empty).
var ErrNotReady = errors.New("vector collection not ready")