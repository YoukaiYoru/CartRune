package reviews

import (
	"errors"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/YoukaiYoru/api/internal/social"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
	rec  social.ActivityRecorder
}

func NewService(repo *Repository, recorder social.ActivityRecorder) *Service {
	return &Service{repo: repo, rec: recorder}
}

func (s *Service) GetGameReviews(gameID uuid.UUID, page, limit int) ([]ReviewResponse, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	reviews, total, err := s.repo.FindByGameID(gameID, offset, limit)
	if err != nil {
		return nil, 0, err
	}

	var response []ReviewResponse
	for _, rev := range reviews {
		response = append(response, reviewToResponse(&rev, s.repo))
	}
	return response, total, nil
}

func (s *Service) CreateReview(userID uuid.UUID, req CreateReviewRequest) (*ReviewResponse, error) {
	gameID, err := uuid.Parse(req.GameID)
	if err != nil {
		return nil, errors.New("invalid game id")
	}

	if req.Rating < 1 || req.Rating > 5 {
		return nil, errors.New("rating must be between 1 and 5")
	}

	review := &models.Review{
		ID:      uuid.New(),
		UserID:  userID,
		GameID:  gameID,
		Rating:  req.Rating,
		Title:   req.Title,
		Content: req.Content,
		Spoiler: req.Spoiler,
	}

	if err := s.repo.Create(review); err != nil {
		return nil, err
	}

	// Reload with user
	review, err = s.repo.FindByID(review.ID)
	if err != nil {
		return nil, err
	}

	if s.rec != nil {
		_ = s.rec(userID, "review", review.ID)
	}

	resp := reviewToResponse(review, s.repo)
	return &resp, nil
}

func (s *Service) UpdateReview(id, userID uuid.UUID, req UpdateReviewRequest) (*ReviewResponse, error) {
	review, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("review not found")
		}
		return nil, err
	}

	if review.UserID != userID {
		return nil, errors.New("unauthorized")
	}

	if req.Rating != nil {
		if *req.Rating < 1 || *req.Rating > 5 {
			return nil, errors.New("rating must be between 1 and 5")
		}
		review.Rating = *req.Rating
	}
	if req.Title != "" {
		review.Title = req.Title
	}
	if req.Content != "" {
		review.Content = req.Content
	}
	if req.Spoiler != nil {
		review.Spoiler = *req.Spoiler
	}

	if err := s.repo.Update(review); err != nil {
		return nil, err
	}

	resp := reviewToResponse(review, s.repo)
	return &resp, nil
}

func (s *Service) DeleteReview(id, userID uuid.UUID) error {
	review, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if review.UserID != userID {
		return errors.New("unauthorized")
	}

	return s.repo.Delete(id)
}

func (s *Service) LikeReview(reviewID, userID uuid.UUID) error {
	_, err := s.repo.FindByID(reviewID)
	if err != nil {
		return errors.New("review not found")
	}
	return s.repo.Like(reviewID, userID)
}

func (s *Service) UnlikeReview(reviewID, userID uuid.UUID) error {
	return s.repo.Unlike(reviewID, userID)
}

func (s *Service) AddComment(reviewID, userID uuid.UUID, content string) (*CommentResponse, error) {
	_, err := s.repo.FindByID(reviewID)
	if err != nil {
		return nil, errors.New("review not found")
	}

	comment := &models.Comment{
		ID:       uuid.New(),
		ReviewID: reviewID,
		UserID:   userID,
		Content:  content,
	}

	if err := s.repo.CreateComment(comment); err != nil {
		return nil, err
	}

	resp := commentToResponse(comment)
	return &resp, nil
}

func (s *Service) GetComments(reviewID uuid.UUID, page, limit int) ([]CommentResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	comments, err := s.repo.GetComments(reviewID, offset, limit)
	if err != nil {
		return nil, err
	}

	var response []CommentResponse
	for _, c := range comments {
		response = append(response, commentToResponse(&c))
	}
	return response, nil
}

func reviewToResponse(r *models.Review, repo *Repository) ReviewResponse {
	resp := ReviewResponse{
		ID:         r.ID.String(),
		UserID:     r.UserID.String(),
		GameID:     r.GameID.String(),
		Rating:     r.Rating,
		Title:      r.Title,
		Content:    r.Content,
		Spoiler:    r.Spoiler,
		CreatedAt:  r.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  r.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		LikesCount: int(repo.GetLikesCount(r.ID)),
	}
	if r.User.Username != "" {
		resp.Username = r.User.Username
		resp.AvatarURL = r.User.AvatarURL
	}
	return resp
}

func commentToResponse(c *models.Comment) CommentResponse {
	resp := CommentResponse{
		ID:        c.ID.String(),
		UserID:    c.UserID.String(),
		ReviewID:  c.ReviewID.String(),
		Content:   c.Content,
		CreatedAt: c.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if c.User.Username != "" {
		resp.Username = c.User.Username
		resp.AvatarURL = c.User.AvatarURL
	}
	return resp
}
