package com.lgk.checkin.repo;

import com.lgk.checkin.domain.CheckinTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface CheckinTaskRepository extends JpaRepository<CheckinTask, Long> {

    List<CheckinTask> findAllByOrderByStartTimeDesc();

    @Query("select count(t) from CheckinTask t where t.startTime <= :now and t.endTime >= :now")
    long countOngoing(@Param("now") LocalDateTime now);

    boolean existsByTitleAndStartTime(String title, LocalDateTime startTime);
}
