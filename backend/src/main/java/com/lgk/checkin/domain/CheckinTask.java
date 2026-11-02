package com.lgk.checkin.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "checkin_tasks")
public class CheckinTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "title", nullable = false, length = 80)
    private String title;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "location", length = 120)
    private String location;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    /** 应到人数，0 表示按系统内普通用户总数统计 */
    @Column(name = "expected_count", nullable = false)
    private int expectedCount = 0;

    @Column(name = "qr_ttl_seconds", nullable = false)
    private int qrTtlSeconds = 60;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
